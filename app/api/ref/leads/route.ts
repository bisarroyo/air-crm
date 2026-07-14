import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { customers, referrals, logs, status, priority } from '@/db/schema'
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
        return NextResponse.json([])
    }

    const leads = await db
        .select({
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            createdAt: customers.createdAt,
            statusName: status.status,
            statusColor: status.color,
            priorityName: priority.priority,
            priorityColor: priority.color
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .where(eq(customers.referralId, referral.id))
        .orderBy(customers.createdAt)

    return NextResponse.json(leads)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || session.user.role !== 'ref') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.name || !body.email || !body.phone) {
        return NextResponse.json(
            { error: 'Name, email, and phone are required' },
            { status: 400 }
        )
    }

    const [referral] = await db
        .select()
        .from(referrals)
        .where(eq(referrals.userId, session.user.id))
        .limit(1)

    if (!referral) {
        return NextResponse.json(
            { error: 'No referral code assigned' },
            { status: 400 }
        )
    }

    const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.email, body.email))
        .limit(1)

    if (existing) {
        return NextResponse.json(
            { error: 'A customer with this email already exists' },
            { status: 409 }
        )
    }

    const [newCustomer] = await db
        .insert(customers)
        .values({
            name: body.name,
            email: body.email,
            phone: body.phone,
            travelTime: body.travelTime || '',
            statusId: 1,
            priorityId: 1,
            referralId: referral.id,
            assignedTo: session.user.id
        })
        .returning()

    await db.insert(logs).values({
        customerId: newCustomer.id,
        action: 'lead_created',
        userId: session.user.id,
        changes: JSON.stringify({
            name: body.name,
            email: body.email,
            phone: body.phone,
            referralCode: referral.code
        })
    })

    return NextResponse.json(newCustomer, { status: 201 })
}
