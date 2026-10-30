import { canAccessLeads } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeadTags, travelLeads, travelTags } from '@/db/schema'
import {
    enqueueLeadSyncs,
    getOrganizationId,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

const TAG_ACTIONS = ['add', 'remove', 'replace'] as const
type TagAction = (typeof TAG_ACTIONS)[number]

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, statusId, tagAction } = body

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
            { error: 'No se proporcionaron leads' },
            { status: 400 }
        )
    }

    const leadIds = [
        ...new Set(
            ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        )
    ]

    if (leadIds.length === 0) {
        return NextResponse.json(
            { error: 'No se proporcionaron leads válidos' },
            { status: 400 }
        )
    }

    if (!(await canAccessLeads(session, 'travel', leadIds))) {
        return NextResponse.json({ error: 'Leads fuera de la organización activa' }, { status: 403 })
    }

    const hasStatusUpdate =
        statusId !== undefined && statusId !== null && statusId !== ''
    const hasTagUpdate = tagAction !== undefined && tagAction !== null

    if (!hasStatusUpdate && !hasTagUpdate) {
        return NextResponse.json(
            { error: 'Seleccioná un estado o etiquetas para aplicar' },
            { status: 400 }
        )
    }

    try {
        let updated = 0

        if (hasStatusUpdate) {
            const existing = await db
                .select({ id: travelLeads.id, statusId: travelLeads.statusId })
                .from(travelLeads)
                .where(inArray(travelLeads.id, leadIds))

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

            updated += movedIds.length
        }

        if (hasTagUpdate) {
            if (!TAG_ACTIONS.includes(tagAction as TagAction)) {
                return NextResponse.json(
                    { error: 'Acción de etiquetas inválida' },
                    { status: 400 }
                )
            }

            const action = tagAction as TagAction
            const rawTagIds: number[] = Array.isArray(body.tagIds)
                ? [
                      ...new Set<number>(
                          body.tagIds
                              .map((value: unknown) => Number(value))
                              .filter(
                                  (id: number) =>
                                      Number.isInteger(id) && id > 0
                              )
                      )
                  ]
                : []

            if (action === 'add' && rawTagIds.length === 0) {
                return NextResponse.json(
                    { error: 'Seleccioná al menos una etiqueta para agregar' },
                    { status: 400 }
                )
            }

            if (action === 'remove' && rawTagIds.length === 0) {
                return NextResponse.json(
                    { error: 'Seleccioná al menos una etiqueta para quitar' },
                    { status: 400 }
                )
            }

            // Para agregar solo se aceptan etiquetas activas y existentes.
            // Para quitar permitimos cualquier etiqueta asignada, incluso si
            // fue desactivada después.
            let tagIds = rawTagIds
            if (action !== 'remove') {
                const activeTags = await db
                    .select({ id: travelTags.id })
                    .from(travelTags)
                    .where(
                        and(
                            inArray(travelTags.id, rawTagIds),
                            eq(travelTags.isActive, 1)
                        )
                    )
                tagIds = activeTags.map((tag) => tag.id)
            }

            if (action === 'add' && tagIds.length === 0) {
                return NextResponse.json(
                    { error: 'Las etiquetas seleccionadas no están disponibles' },
                    { status: 400 }
                )
            }

            if (action === 'replace') {
                await db
                    .delete(travelLeadTags)
                    .where(inArray(travelLeadTags.leadId, leadIds))
            } else if (action === 'remove') {
                await db
                    .delete(travelLeadTags)
                    .where(
                        and(
                            inArray(travelLeadTags.leadId, leadIds),
                            inArray(travelLeadTags.tagId, tagIds)
                        )
                    )
            }

            if (action !== 'remove' && tagIds.length > 0) {
                const rows = leadIds.flatMap((leadId) =>
                    tagIds.map((tagId) => ({ leadId, tagId }))
                )
                if (rows.length > 0) {
                    await db
                        .insert(travelLeadTags)
                        .values(rows)
                        .onConflictDoNothing()
                }
            }

            updated += leadIds.length
        }

        return NextResponse.json({
            success: true,
            updated
        })
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudieron actualizar los leads'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
