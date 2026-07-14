import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, like, or, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, status, priority, logs } from '@/db/schema'
import { user } from '@/auth-schema'

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
