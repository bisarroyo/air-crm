import { organizationAccess } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
    and,
    asc,
    eq,
    gte,
    inArray,
    isNull,
    like,
    lte,
    or,
    sql,
    type SQL
} from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
    travelLeadTags,
    travelLeads,
    travelStatuses
} from '@/db/schema'
import {
    getTravelTagsByLeadIds,
    resolveTravelTagIds
} from '@/lib/travel-tags'
import {
    enqueueLeadSync,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

async function defaultStatusId() {
    const [first] = await db
        .select({ id: travelStatuses.id })
        .from(travelStatuses)
        .orderBy(asc(travelStatuses.id))
        .limit(1)
    return first?.id ?? null
}

function normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const organizationId = await organizationAccess(session)
    if (!organizationId) {
        return NextResponse.json({ error: 'Seleccioná una organización de la que seas miembro' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const statusId = searchParams.get('statusId')
    const tagIds = searchParams.get('tagIds')
    const travelDateFrom = normalizeDate(searchParams.get('travelDateFrom'))
    const travelDateTo = normalizeDate(searchParams.get('travelDateTo'))
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(
        100,
        Math.max(1, Number(searchParams.get('pageSize')) || 25)
    )
    const offset = (page - 1) * pageSize

    const conditions: SQL[] = [eq(travelLeads.organizationId, organizationId)]

    if (search) {
        conditions.push(
            or(
                like(travelLeads.name, `%${search}%`),
                like(travelLeads.email, `%${search}%`),
                like(travelLeads.phone, `%${search}%`)
            )!
        )
    }

    if (statusId) {
        conditions.push(eq(travelLeads.statusId, Number(statusId)))
    }

    if (tagIds) {
        const ids = tagIds.split(',').map(Number).filter(Boolean)
        if (ids.length > 0) {
            const tagSubquery = db
                .select({ leadId: travelLeadTags.leadId })
                .from(travelLeadTags)
                .where(inArray(travelLeadTags.tagId, ids))
            conditions.push(inArray(travelLeads.id, tagSubquery))
        }
    }

    // El filtro por fechas devuelve los leads cuyo rango estimado se cruza con
    // el rango consultado: si puede viajar entre el 10 y el 20 de diciembre,
    // aparece al filtrar "diciembre".
    if (travelDateFrom) {
        conditions.push(
            or(
                gte(travelLeads.travelDateTo, travelDateFrom),
                and(
                    isNull(travelLeads.travelDateTo),
                    gte(travelLeads.travelDateFrom, travelDateFrom)
                )
            )!
        )
    }

    if (travelDateTo) {
        conditions.push(
            or(
                lte(travelLeads.travelDateFrom, travelDateTo),
                and(
                    isNull(travelLeads.travelDateFrom),
                    lte(travelLeads.travelDateTo, travelDateTo)
                )
            )!
        )
    }

    const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(travelLeads)
        .where(whereClause)

    const rows = await db
        .select({
            id: travelLeads.id,
            name: travelLeads.name,
            phone: travelLeads.phone,
            email: travelLeads.email,
            metaInboxUrl: travelLeads.metaInboxUrl,
            statusId: travelLeads.statusId,
            travelDateFrom: travelLeads.travelDateFrom,
            travelDateTo: travelLeads.travelDateTo,
            createdAt: travelLeads.createdAt,
            updatedAt: travelLeads.updatedAt,
            statusName: travelStatuses.status,
            statusIsActive: travelStatuses.isActive,
            statusColor: travelStatuses.color
        })
        .from(travelLeads)
        .leftJoin(travelStatuses, eq(travelLeads.statusId, travelStatuses.id))
        .where(whereClause)
        .orderBy(sql`${travelLeads.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset)

    const tagsByLead = await getTravelTagsByLeadIds(rows.map((row) => row.id))

    return NextResponse.json({
        data: rows.map((row) => ({
            ...row,
            tags: tagsByLead.get(row.id) ?? []
        })),
        total: Number(countResult.count),
        page,
        pageSize
    })
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const organizationId = await organizationAccess(session)
    if (!organizationId) {
        return NextResponse.json({ error: 'Seleccioná una organización de la que seas miembro' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
        return NextResponse.json(
            { error: 'El nombre es obligatorio' },
            { status: 400 }
        )
    }

    const statusId = body.statusId
        ? Number(body.statusId)
        : await defaultStatusId()

    if (!statusId) {
        return NextResponse.json(
            {
                error: 'No hay estados de viaje configurados. Creá uno en Administración.'
            },
            { status: 400 }
        )
    }

    try {
        const [created] = await db
            .insert(travelLeads)
            .values({
                organizationId,
                name,
                phone:
                    typeof body.phone === 'string' ? body.phone.trim() : '',
                email:
                    typeof body.email === 'string' ? body.email.trim() : '',
                metaInboxUrl:
                    typeof body.metaInboxUrl === 'string' &&
                    body.metaInboxUrl.trim()
                        ? body.metaInboxUrl.trim()
                        : null,
                statusId,
                travelDateFrom: normalizeDate(body.travelDateFrom),
                travelDateTo: normalizeDate(body.travelDateTo),
                statusChangedAt: new Date()
            })
            .returning()

        const tagIds = await resolveTravelTagIds(body.tagIds)
        if (tagIds.length > 0) {
            await db.insert(travelLeadTags).values(
                tagIds.map((tagId) => ({
                    leadId: created.id,
                    tagId
                }))
            )
        }

        if (await enqueueLeadSync(organizationId, 'travel', created.id)) {
            scheduleGoogleSheetsProcessing(organizationId)
        }

        const tagsByLead = await getTravelTagsByLeadIds([created.id])

        return NextResponse.json(
            {
                ...created,
                tags: tagsByLead.get(created.id) ?? []
            },
            { status: 201 }
        )
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'No se pudo crear el lead'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
