import { canAccessLeads } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeadNotes } from '@/db/schema'
import {
    enqueueLeadSync,
    getOrganizationId,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string; noteId: string }> }
) {
    const { id, noteId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    const [existing] = await db
        .select()
        .from(travelLeadNotes)
        .where(
            and(
                eq(travelLeadNotes.id, Number(noteId)),
                eq(travelLeadNotes.leadId, Number(id))
            )
        )
        .limit(1)

    if (!existing) {
        return NextResponse.json(
            { error: 'Nota no encontrada' },
            { status: 404 }
        )
    }

    if (
        existing.userId !== session.user.id &&
        session.user.role !== 'admin'
    ) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        await db
            .delete(travelLeadNotes)
            .where(
                and(
                    eq(travelLeadNotes.id, Number(noteId)),
                    eq(travelLeadNotes.leadId, Number(id))
                )
            )

        const organizationId = await getOrganizationId(session)
        if (
            await enqueueLeadSync(
                organizationId,
                'travel',
                Number(id)
            )
        ) {
            scheduleGoogleSheetsProcessing(organizationId)
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo eliminar la nota'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
