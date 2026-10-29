import { canAccessLeads } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeadNotes } from '@/db/schema'
import { user } from '@/auth-schema'
import {
    enqueueLeadSync,
    getOrganizationId,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    const rows = await db
        .select({
            id: travelLeadNotes.id,
            note: travelLeadNotes.note,
            createdAt: travelLeadNotes.createdAt,
            userId: travelLeadNotes.userId,
            userName: user.name,
            userEmail: user.email
        })
        .from(travelLeadNotes)
        .leftJoin(user, eq(travelLeadNotes.userId, user.id))
        .where(eq(travelLeadNotes.leadId, Number(id)))
        .orderBy(desc(travelLeadNotes.createdAt))

    return NextResponse.json(rows)
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    const body = await request.json()
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    if (!note) {
        return NextResponse.json(
            { error: 'La nota es obligatoria' },
            { status: 400 }
        )
    }

    try {
        const [created] = await db
            .insert(travelLeadNotes)
            .values({
                leadId: Number(id),
                note,
                userId: session.user.id
            })
            .returning()

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

        return NextResponse.json(created, { status: 201 })
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'No se pudo crear la nota'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
