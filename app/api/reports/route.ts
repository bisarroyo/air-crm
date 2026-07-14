import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, sql, and, gte, lte, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, status, priority, referrals } from '@/db/schema'

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusIds = searchParams.get('statusIds')?.split(',').map(Number).filter(Boolean)
    const referralCode = searchParams.get('referralCode')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const conditions = []

    if (statusIds && statusIds.length > 0) {
        conditions.push(inArray(customers.statusId, statusIds))
    }

    if (referralCode) {
        const [referral] = await db
            .select()
            .from(referrals)
            .where(eq(referrals.code, referralCode))
            .limit(1)
        if (referral) {
            conditions.push(eq(customers.referralId, referral.id))
        } else {
            return NextResponse.json({
                byStatus: [],
                byPriority: [],
                byTravelTime: [],
                byMonth: [],
                byReferral: [],
                total: 0,
                thisMonth: 0,
                lastMonth: 0
            })
        }
    }

    if (dateFrom) {
        conditions.push(gte(customers.createdAt, new Date(dateFrom)))
    }
    if (dateTo) {
        conditions.push(lte(customers.createdAt, new Date(dateTo)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const allCustomers = await db
        .select({
            id: customers.id,
            statusId: customers.statusId,
            priorityId: customers.priorityId,
            travelTime: customers.travelTime,
            referralId: customers.referralId,
            createdAt: customers.createdAt
        })
        .from(customers)
        .where(whereClause)

    const statuses = await db.select().from(status)
    const priorities = await db.select().from(priority)
    const allReferrals = await db.select().from(referrals)

    const statusMap = new Map(statuses.map(s => [s.id, s]))
    const priorityMap = new Map(priorities.map(p => [p.id, p]))
    const referralMap = new Map(allReferrals.map(r => [r.id, r]))

    const byStatus: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    const byTravelTime: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    const byReferral: Record<string, number> = {}

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    let thisMonthCount = 0
    let lastMonthCount = 0

    const travelTimeLabels: Record<string, string> = {
        '0-3': 'Lo antes posible',
        '3-6': 'En 3-6 meses',
        '6-12': 'En 6-12 meses',
        '12-18': 'En 12-18 meses',
        '0': 'Solo explorando'
    }

    for (const c of allCustomers) {
        const statusName = statusMap.get(c.statusId)?.status || 'Unknown'
        byStatus[statusName] = (byStatus[statusName] || 0) + 1

        const priorityName = priorityMap.get(c.priorityId)?.priority || 'Unknown'
        byPriority[priorityName] = (byPriority[priorityName] || 0) + 1

        const ttLabel = travelTimeLabels[c.travelTime] || c.travelTime || 'Unknown'
        byTravelTime[ttLabel] = (byTravelTime[ttLabel] || 0) + 1

        if (c.createdAt) {
            const d = new Date(c.createdAt)
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            byMonth[monthKey] = (byMonth[monthKey] || 0) + 1

            if (d >= thisMonthStart && d <= now) thisMonthCount++
            if (d >= lastMonthStart && d <= lastMonthEnd) lastMonthCount++
        }

        if (c.referralId) {
            const refCode = referralMap.get(c.referralId)?.code || 'Unknown'
            byReferral[refCode] = (byReferral[refCode] || 0) + 1
        }
    }

    const toChartArray = (obj: Record<string, number>) =>
        Object.entries(obj)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)

    const monthArray = Object.entries(byMonth)
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
        byStatus: toChartArray(byStatus),
        byPriority: toChartArray(byPriority),
        byTravelTime: toChartArray(byTravelTime),
        byMonth: monthArray,
        byReferral: toChartArray(byReferral),
        total: allCustomers.length,
        thisMonth: thisMonthCount,
        lastMonth: lastMonthCount
    })
}
