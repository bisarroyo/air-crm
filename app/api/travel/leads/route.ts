import { organizationAccess } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, asc, eq, like, or, sql, type SQL } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeads, travelStatuses } from '@/db/schema'
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

    return NextResponse.json({
        data: rows,
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
                statusChangedAt: new Date()
            })
            .returning()

        if (await enqueueLeadSync(organizationId, 'travel', created.id)) {
            scheduleGoogleSheetsProcessing(organizationId)
        }

        return NextResponse.json(created, { status: 201 })
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'No se pudo crear el lead'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
