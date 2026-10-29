import { canAccessLeads } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeads } from '@/db/schema'
import {
    enqueueLeadSyncs,
    getOrganizationId,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, statusId } = body

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
            { error: 'No se proporcionaron leads' },
            { status: 400 }
        )
    }

    if (!(await canAccessLeads(session, 'travel', ids.map(Number)))) {
        return NextResponse.json({ error: 'Leads fuera de la organización activa' }, { status: 403 })
    }

    if (statusId === undefined || statusId === null || statusId === '') {
        return NextResponse.json(
            { error: 'Seleccioná un estado para aplicar' },
            { status: 400 }
        )
    }

    try {
        const existing = await db
            .select({ id: travelLeads.id, statusId: travelLeads.statusId })
            .from(travelLeads)
            .where(inArray(travelLeads.id, ids))

        const now = new Date()
        const movedIds = existing
            .filter((lead) => lead.statusId !== Number(statusId))
            .map((lead) => lead.id)

        if (movedIds.length > 0) {
            await db
                .update(travelLeads)
                .set({ statusId: Number(statusId), statusChangedAt: now })
                .where(inArray(travelLeads.id, movedIds))

            const organizationId = await getOrganizationId(session)
            if (
                await enqueueLeadSyncs(
                    organizationId,
                    'travel',
                    movedIds
                )
            ) {
                scheduleGoogleSheetsProcessing(organizationId)
            }
        }

        return NextResponse.json({
            success: true,
            updated: movedIds.length
        })
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudieron actualizar los leads'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
