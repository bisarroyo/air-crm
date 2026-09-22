import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerEvents, customers } from '@/db/schema'
import { user } from '@/auth-schema'

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const conditions: SQL[] = []

    if (session.user.role && session.user.role !== 'admin') {
        const scoped = db
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.assignedTo, session.user.id))
        conditions.push(inArray(customerEvents.customerId, scoped))
    }

    if (from) {
        conditions.push(sql`${customerEvents.scheduledAt} >= ${new Date(from).getTime()}`)
    }
    if (to) {
        conditions.push(sql`${customerEvents.scheduledAt} <= ${new Date(to).getTime()}`)
    }

    const rows = await db
        .select({
            id: customerEvents.id,
            customerId: customerEvents.customerId,
            customerName: customers.name,
            type: customerEvents.type,
            title: customerEvents.title,
            scheduledAt: customerEvents.scheduledAt,
            status: customerEvents.status,
            meetingLink: customerEvents.meetingLink,
            createdAt: customerEvents.createdAt,
            userId: customerEvents.userId,
            userName: user.name
        })
        .from(customerEvents)
        .innerJoin(customers, eq(customerEvents.customerId, customers.id))
        .leftJoin(user, eq(customerEvents.userId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)

    rows.sort((a, b) => {
        const aTime = a.scheduledAt ? a.scheduledAt.getTime() : 0
        const bTime = b.scheduledAt ? b.scheduledAt.getTime() : 0
        if (a.scheduledAt && b.scheduledAt) return aTime - bTime
        if (a.scheduledAt && !b.scheduledAt) return -1
        return 1
    })

    return NextResponse.json(rows)
}