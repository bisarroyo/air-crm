import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerEvents } from '@/db/schema'

const EVENT_TYPES = ['videollamada', 'charla', 'presencial']
const EVENT_STATUSES = ['pending', 'attended', 'no_show']

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; eventId: string }> }
) {
    const { id, eventId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const [existing] = await db
        .select()
        .from(customerEvents)
        .where(
            and(
                eq(customerEvents.id, Number(eventId)),
                eq(customerEvents.customerId, Number(id))
            )
        )
        .limit(1)

    if (!existing) {
        return NextResponse.json(
            { error: 'Event not found' },
            { status: 404 }
        )
    }

    const updateData: Record<string, string | Date | null> = {}

    if (body.type !== undefined) {
        if (!EVENT_TYPES.includes(body.type)) {
            return NextResponse.json(
                { error: 'Invalid event type' },
                { status: 400 }
            )
        }
        updateData.type = body.type
    }

    if (body.title !== undefined) {
        updateData.title =
            typeof body.title === 'string' && body.title.trim()
                ? body.title.trim()
                : null
    }

    if (body.scheduledAt !== undefined) {
        updateData.scheduledAt =
            body.scheduledAt === null
                ? null
                : new Date(body.scheduledAt)
        if (
            updateData.scheduledAt &&
            Number.isNaN(updateData.scheduledAt.getTime())
        ) {
            updateData.scheduledAt = null
        }
    }

    if (body.status !== undefined) {
        if (!EVENT_STATUSES.includes(body.status)) {
            return NextResponse.json(
                { error: 'Invalid status' },
                { status: 400 }
            )
        }
        updateData.status = body.status
    }

    if (body.meetingLink !== undefined) {
        updateData.meetingLink =
            typeof body.meetingLink === 'string' && body.meetingLink.trim()
                ? body.meetingLink.trim()
                : null
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(customerEvents)
            .set(updateData)
            .where(
                and(
                    eq(customerEvents.id, Number(eventId)),
                    eq(customerEvents.customerId, Number(id))
                )
            )
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to update event' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string; eventId: string }> }
) {
    const { id, eventId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [existing] = await db
            .select()
            .from(customerEvents)
            .where(
                and(
                    eq(customerEvents.id, Number(eventId)),
                    eq(customerEvents.customerId, Number(id))
                )
            )
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            )
        }

        if (
            existing.userId !== session.user.id &&
            session.user.role !== 'admin'
        ) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            )
        }

        const [deleted] = await db
            .delete(customerEvents)
            .where(
                and(
                    eq(customerEvents.id, Number(eventId)),
                    eq(customerEvents.customerId, Number(id))
                )
            )
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to delete event' },
            { status: 500 }
        )
    }
}