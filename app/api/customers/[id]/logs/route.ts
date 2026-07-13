import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { logs, customers, referrals } from '@/db/schema'
import { user } from '@/auth-schema'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
        .select({
            id: logs.id,
            action: logs.action,
            changes: logs.changes,
            createdAt: logs.createdAt,
            userName: user.name,
            userEmail: user.email,
            referralCode: referrals.code
        })
        .from(logs)
        .leftJoin(user, eq(logs.userId, user.id))
        .leftJoin(customers, eq(logs.customerId, customers.id))
        .leftJoin(referrals, eq(customers.referralId, referrals.id))
        .where(eq(logs.customerId, Number(id)))
        .orderBy(desc(logs.createdAt))

    return NextResponse.json(rows)
}
