import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, like, or, inArray, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, customerTags, tags, status, priority } from '@/db/schema'
import { CAMPAIGN_MAX_RECIPIENTS } from '@/lib/email/constants'
import { isValidEmail } from '@/lib/email/template'

const PAGE_SIZE = 50

/**
 * Opciones para el selector de destinatarios. `allMatching=true` devuelve solo
 * los ids (sin paginar) para poder marcar "seleccionar todos los resultados"
 * sin que se lose el filtro.
 */
export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const statusId = searchParams.get('statusId')
    const priorityId = searchParams.get('priorityId')
    const tagId = searchParams.get('tagId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const allMatching = searchParams.get('allMatching') === 'true'

    const conditions: ReturnType<typeof eq>[] = []

    // Los asesores solo pueden escribir a sus propios clientes.
    if (session.user.role !== 'admin') {
        conditions.push(eq(customers.assignedTo, session.user.id))
    }

    if (search) {
        const pattern = `%${search}%`
        conditions.push(
            or(
                like(customers.name, pattern),
                like(customers.email, pattern),
                like(customers.phone, pattern),
                like(customers.country, pattern)
            ) as ReturnType<typeof eq>
        )
    }

    if (statusId) {
        conditions.push(eq(customers.statusId, Number(statusId)))
    }

    if (priorityId) {
        conditions.push(eq(customers.priorityId, Number(priorityId)))
    }

    if (tagId) {
        conditions.push(
            inArray(
                customers.id,
                db
                    .select({ customerId: customerTags.customerId })
                    .from(customerTags)
                    .where(eq(customerTags.tagId, Number(tagId)))
            ) as unknown as ReturnType<typeof eq>
        )
    }

    const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined

    if (allMatching) {
        const rows = await db
            .select({
                id: customers.id,
                name: customers.name,
                email: customers.email
            })
            .from(customers)
            .where(whereClause)
            .orderBy(customers.name)
            .limit(CAMPAIGN_MAX_RECIPIENTS + 1)

        const capped = rows.slice(0, CAMPAIGN_MAX_RECIPIENTS)

        return NextResponse.json({
            data: capped.map((row) => ({
                ...row,
                reachable: isValidEmail(row.email)
            })),
            ids: capped.map((row) => row.id),
            truncated: rows.length > CAMPAIGN_MAX_RECIPIENTS
        })
    }

    const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(whereClause)

    const total = Number(countRow?.count ?? 0)

    const rows = await db
        .select({
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            country: customers.country,
            statusId: customers.statusId,
            statusName: status.status,
            statusColor: status.color,
            priorityId: customers.priorityId,
            priorityName: priority.priority
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .where(whereClause)
        .orderBy(customers.name)
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)

    const tagsByCustomer = new Map<number, string[]>()
    if (rows.length > 0) {
        const tagRows = await db
            .select({
                customerId: customerTags.customerId,
                name: tags.tag
            })
            .from(customerTags)
            .innerJoin(tags, eq(customerTags.tagId, tags.id))
            .where(
                inArray(
                    customerTags.customerId,
                    rows.map((row) => row.id)
                )
            )

        for (const tagRow of tagRows) {
            const list = tagsByCustomer.get(tagRow.customerId) || []
            list.push(tagRow.name)
            tagsByCustomer.set(tagRow.customerId, list)
        }
    }

    return NextResponse.json({
        data: rows.map((row) => ({
            ...row,
            tags: tagsByCustomer.get(row.id) || [],
            reachable: isValidEmail(row.email)
        })),
        total,
        page,
        pageSize: PAGE_SIZE
    })
}