import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { referrals } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || session.user.role !== 'ref') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const [referral] = await db
        .select()
        .from(referrals)
        .where(eq(referrals.userId, session.user.id))
        .limit(1)

    if (!referral) {
        return NextResponse.json({ error: 'No referral code found' }, { status: 404 })
    }

    return NextResponse.json(referral)
}
