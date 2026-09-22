import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, desc, eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import {
    toSummary,
    type SessionUser
} from '@/lib/cotizaciones/quotation'
import {
    QUOTATION_STATUSES,
    type QuotationStatus
} from '@/lib/cotizaciones/shared'

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(
        100,
        Math.max(1, Number(searchParams.get('pageSize')) || 25)
    )
    const offset = (page - 1) * pageSize

    const isAdmin = session.user.role === 'admin'

    const conditions: ReturnType<typeof eq>[] = []

    if (!isAdmin) {
        conditions.push(eq(quotations.advisorId, session.user.id))
    }
    if (
        status &&
        QUOTATION_STATUSES.includes(status as QuotationStatus)
    ) {
        conditions.push(eq(quotations.status, status as QuotationStatus))
    }
    if (customerId) {
        conditions.push(eq(quotations.customerId, Number(customerId)))
    }

    const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined

    const visibilityWhere = !isAdmin
        ? eq(quotations.advisorId, session.user.id)
        : undefined

    const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotations)
        .where(whereClause)

    const rows = await db
        .select()
        .from(quotations)
        .where(whereClause)
        .orderBy(desc(quotations.createdAt), desc(quotations.id))
        .limit(pageSize)
        .offset(offset)

    const clients = await db
        .selectDistinct({
            id: quotations.customerId,
            name: quotations.clientName
        })
        .from(quotations)
        .where(visibilityWhere)
        .orderBy(quotations.clientName)

    const sessionUser: SessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    return NextResponse.json({
        data: rows.map((row) => toSummary(row, sessionUser)),
        total: Number(countResult.count),
        page,
        pageSize,
        clients
    })
}