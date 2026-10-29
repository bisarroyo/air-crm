import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeadEvents } from '@/db/schema'
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
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const rows = await db
        .select({
            id: travelLeadEvents.id,
            type: travelLeadEvents.type,
            title: travelLeadEvents.title,
            scheduledAt: travelLeadEvents.scheduledAt,
            status: travelLeadEvents.status,
            meetingLink: travelLeadEvents.meetingLink,
            createdAt: travelLeadEvents.createdAt,
            userId: travelLeadEvents.userId,
            userName: user.name,
            userEmail: user.email
        })
        .from(travelLeadEvents)
        .leftJoin(user, eq(travelLeadEvents.userId, user.id))
        .where(eq(travelLeadEvents.leadId, Number(id)))

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
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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
            .insert(travelLeadEvents)
            .values({
                leadId: Number(id),
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
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo crear el evento'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
