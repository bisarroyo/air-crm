import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerEvents } from '@/db/schema'
import { user } from '@/auth-schema'

const EVENT_TYPES = ['videollamada', 'charla', 'presencial']

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
            id: customerEvents.id,
            type: customerEvents.type,
            title: customerEvents.title,
            scheduledAt: customerEvents.scheduledAt,
            status: customerEvents.status,
            meetingLink: customerEvents.meetingLink,
            createdAt: customerEvents.createdAt,
            userId: customerEvents.userId,
            userName: user.name,
            userEmail: user.email
        })
        .from(customerEvents)
        .leftJoin(user, eq(customerEvents.userId, user.id))
        .where(eq(customerEvents.customerId, Number(id)))

    rows.sort((a, b) => {
        const aTime = a.scheduledAt ? a.scheduledAt.getTime() : 0
        const bTime = b.scheduledAt ? b.scheduledAt.getTime() : 0
        if (a.scheduledAt && b.scheduledAt) return aTime - bTime
        if (a.scheduledAt && !b.scheduledAt) return -1
        return 1
    })

    return NextResponse.json(rows)
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const type = EVENT_TYPES.includes(body.type) ? body.type : 'charla'

    let scheduledAt: Date | null = null
    if (body.scheduledAt) {
        const parsed = new Date(body.scheduledAt)
        if (!Number.isNaN(parsed.getTime())) {
            scheduledAt = parsed
        }
    }

    try {
        const [created] = await db
            .insert(customerEvents)
            .values({
                customerId: Number(id),
                type,
                title: body.title ? String(body.title).trim() || null : null,
                scheduledAt,
                status: 'pending',
                meetingLink: body.meetingLink
                    ? String(body.meetingLink).trim() || null
                    : null,
                userId: session.user.id
            })
            .returning()

        return NextResponse.json(created, { status: 201 })
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to create event' },
            { status: 500 }
        )
    }
}