import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray, like, or, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
    customers,
    status,
    priority,
    logs,
    customerTags,
    tags
} from '@/db/schema'
import { user } from '@/auth-schema'
import { resolveExistingTagIds } from '@/lib/tags'

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const statusId = searchParams.get('statusId')
    const priorityId = searchParams.get('priorityId')
    const assignedTo = searchParams.get('assignedTo')
    const tagIds = searchParams.get('tagIds')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(
        100,
        Math.max(1, Number(searchParams.get('pageSize')) || 25)
    )
    const offset = (page - 1) * pageSize

    const conditions: ReturnType<typeof eq>[] = []

    if (!session.user.role || session.user.role === 'user') {
        conditions.push(eq(customers.assignedTo, session.user.id))
    } else if (assignedTo) {
        conditions.push(eq(customers.assignedTo, assignedTo))
    }

    if (search) {
        conditions.push(
            or(
                like(customers.name, `%${search}%`),
                like(customers.email, `%${search}%`),
                like(customers.phone, `%${search}%`)
            )!
        )
    }

    if (statusId) {
        conditions.push(eq(customers.statusId, Number(statusId)))
    }

    if (priorityId) {
        conditions.push(eq(customers.priorityId, Number(priorityId)))
    }

    if (tagIds) {
        const ids = tagIds.split(',').map(Number).filter(Boolean)
        if (ids.length > 0) {
            const tagSubquery = db
                .select({ customerId: customerTags.customerId })
                .from(customerTags)
                .where(inArray(customerTags.tagId, ids))
            conditions.push(inArray(customers.id, tagSubquery))
        }
    }

    const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(whereClause)

    const rows = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            travelTime: customers.travelTime,
            statusId: customers.statusId,
            priorityId: customers.priorityId,
            assignedTo: customers.assignedTo,
            referralId: customers.referralId,
            createdAt: customers.createdAt,
            updatedAt: customers.updatedAt,
            statusName: status.status,
            statusIsActive: status.isActive,
            statusColor: status.color,
            priorityName: priority.priority,
            priorityIsActive: priority.isActive,
            priorityColor: priority.color,
            assignedUserName: user.name,
            assignedUserEmail: user.email,
            assignedUserImage: user.image
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .leftJoin(user, eq(customers.assignedTo, user.id))
        .where(whereClause)
        .orderBy(sql`${customers.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset)

    let tagsByCustomer = new Map<
        number,
        { id: number; name: string; color: string; isActive: number }[]
    >()
    if (rows.length > 0) {
        const rowIds = rows.map((r) => r.id)
        const tagRows = await db
            .select({
                customerId: customerTags.customerId,
                tagId: tags.id,
                tagName: tags.tag,
                tagColor: tags.color,
                tagIsActive: tags.isActive
            })
            .from(customerTags)
            .innerJoin(tags, eq(customerTags.tagId, tags.id))
            .where(inArray(customerTags.customerId, rowIds))

        tagsByCustomer = new Map()
        for (const tr of tagRows) {
            const list = tagsByCustomer.get(tr.customerId) || []
            list.push({
                id: tr.tagId,
                name: tr.tagName,
                color: tr.tagColor || '#6b7280',
                isActive: tr.tagIsActive
            })
            tagsByCustomer.set(tr.customerId, list)
        }
    }

    const finalRows = rows.map((r) => ({
        ...r,
        tags: tagsByCustomer.get(r.id) || []
    }))

    return NextResponse.json({
        data: finalRows,
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name || !body.email || !body.phone || !body.travelTime) {
        return NextResponse.json(
            { error: 'Name, email, phone, and travel time are required' },
            { status: 400 }
        )
    }

    try {
        const [newCustomer] = await db
            .insert(customers)
            .values({
                name: body.name,
                email: body.email,
                phone: body.phone,
                travelTime: body.travelTime,
                statusId: body.statusId || 1,
                priorityId: body.priorityId || 1,
                assignedTo:
                    body.assignedTo ||
                    session.user.id ||
                    '0vd84cJDrYloFlFJRdErhuztO9J9jwaI'
            })
            .returning()

        const tagIds = await resolveExistingTagIds(body.tagIds)

        if (tagIds.length > 0) {
            await db.insert(customerTags).values(
                tagIds.map((tagId) => ({
                    customerId: newCustomer.id,
                    tagId
                }))
            )
        }

        await db.insert(logs).values({
            customerId: newCustomer.id,
            action: 'created',
            changes: JSON.stringify({
                name: body.name,
                email: body.email,
                phone: body.phone,
                travelTime: body.travelTime
            }),
            userId: session.user.id
        })

        return NextResponse.json(newCustomer, { status: 201 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create customer'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
