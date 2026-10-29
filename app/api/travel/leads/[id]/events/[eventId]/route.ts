import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeadEvents } from '@/db/schema'

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
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const [existing] = await db
        .select()
        .from(travelLeadEvents)
        .where(
            and(
                eq(travelLeadEvents.id, Number(eventId)),
                eq(travelLeadEvents.leadId, Number(id))
            )
        )
        .limit(1)

    if (!existing) {
        return NextResponse.json(
            { error: 'Evento no encontrado' },
            { status: 404 }
        )
    }

    const updateData: Record<string, string | Date | null> = {}

    if (body.type !== undefined) {
        if (!EVENT_TYPES.includes(body.type)) {
            return NextResponse.json(
                { error: 'Tipo de evento inválido' },
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
            body.scheduledAt === null ? null : new Date(body.scheduledAt)
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
                { error: 'Estado inválido' },
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
            { error: 'No hay campos para actualizar' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(travelLeadEvents)
            .set(updateData)
            .where(
                and(
                    eq(travelLeadEvents.id, Number(eventId)),
                    eq(travelLeadEvents.leadId, Number(id))
                )
            )
            .returning()

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo actualizar el evento'
        return NextResponse.json({ error: message }, { status: 500 })
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
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [existing] = await db
        .select()
        .from(travelLeadEvents)
        .where(
            and(
                eq(travelLeadEvents.id, Number(eventId)),
                eq(travelLeadEvents.leadId, Number(id))
            )
        )
        .limit(1)

    if (!existing) {
        return NextResponse.json(
            { error: 'Evento no encontrado' },
            { status: 404 }
        )
    }

    if (
        existing.userId !== session.user.id &&
        session.user.role !== 'admin'
    ) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        await db
            .delete(travelLeadEvents)
            .where(
                and(
                    eq(travelLeadEvents.id, Number(eventId)),
                    eq(travelLeadEvents.leadId, Number(id))
                )
            )

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo eliminar el evento'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
