import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerTasks, customers } from '@/db/schema'
import { user } from '@/auth-schema'

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeCompleted = searchParams.get('includeCompleted') === 'true'

    const conditions: SQL[] = []

    if (!includeCompleted) {
        conditions.push(eq(customerTasks.isCompleted, false))
    }

    if (session.user.role && session.user.role !== 'admin') {
        const scoped = db
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.assignedTo, session.user.id))
        conditions.push(inArray(customerTasks.customerId, scoped))
    }

    const rows = await db
        .select({
            id: customerTasks.id,
            customerId: customerTasks.customerId,
            customerName: customers.name,
            title: customerTasks.title,
            description: customerTasks.description,
            dueDate: customerTasks.dueDate,
            urgency: customerTasks.urgency,
            isCompleted: customerTasks.isCompleted,
            completedAt: customerTasks.completedAt,
            createdAt: customerTasks.createdAt,
            userId: customerTasks.userId,
            userName: user.name
        })
        .from(customerTasks)
        .innerJoin(customers, eq(customerTasks.customerId, customers.id))
        .leftJoin(user, eq(customerTasks.userId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)

    rows.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1
        const aTime = a.dueDate ? a.dueDate.getTime() : 0
        const bTime = b.dueDate ? b.dueDate.getTime() : 0
        if (a.dueDate && b.dueDate) return aTime - bTime
        if (a.dueDate && !b.dueDate) return -1
        return 1
    })

    return NextResponse.json(rows)
}