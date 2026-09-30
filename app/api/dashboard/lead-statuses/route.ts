import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { count, eq, sql } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, status } from '@/db/schema'

export interface LeadStatusCount {
    statusId: number
    name: string
    color: string
    total: number
    newThisWeek: number
}

function startOfCurrentWeek() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
}

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'admin'
    const weekStart = startOfCurrentWeek()
    const weekStartTs = Math.floor(weekStart.getTime() / 1000)

    const grouped = await db
        .select({
            statusId: customers.statusId,
            total: count(),
            newThisWeek: sql<number>`coalesce(
                sum(case when ${customers.statusChangedAt} >= ${weekStartTs} then 1 else 0 end),
                0
            )`
        })
        .from(customers)
        .where(
            isAdmin ? undefined : eq(customers.assignedTo, session.user.id)
        )
        .groupBy(customers.statusId)

    const activeStatuses = await db
        .select({
            statusId: status.id,
            name: status.status,
            color: status.color
        })
        .from(status)
        .where(eq(status.isActive, 1))
        .orderBy(status.id)

    const byStatus = new Map(grouped.map((g) => [g.statusId, g]))

    const counts: LeadStatusCount[] = activeStatuses.map((s) => {
        const row = byStatus.get(s.statusId)
        return {
            statusId: s.statusId,
            name: s.name,
            color: s.color || '#6b7280',
            total: Number(row?.total ?? 0),
            newThisWeek: Number(row?.newThisWeek ?? 0)
        }
    })

    return NextResponse.json({
        counts,
        weekStart: weekStart.toISOString(),
        total: counts.reduce((acc, c) => acc + c.total, 0),
        newThisWeek: counts.reduce((acc, c) => acc + c.newThisWeek, 0)
    })
}