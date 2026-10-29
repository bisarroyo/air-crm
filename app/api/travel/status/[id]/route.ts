import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelStatuses } from '@/db/schema'
import {
    enqueueStatusRenameSync,
    scheduleAllEnabledGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const updateData: Record<string, string | number> = {}

    if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !body.status.trim()) {
            return NextResponse.json(
                { error: 'El nombre del estado es obligatorio' },
                { status: 400 }
            )
        }
        updateData.status = body.status.trim()
    }

    if (body.color !== undefined) {
        updateData.color = body.color
    }

    if (body.isActive !== undefined) {
        updateData.isActive = body.isActive ? 1 : 0
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No hay campos para actualizar' },
            { status: 400 }
        )
    }

    try {
        const [existing] = await db
            .select()
            .from(travelStatuses)
            .where(eq(travelStatuses.id, Number(id)))
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Estado de viaje no encontrado' },
                { status: 404 }
            )
        }

        const nameChanged =
            updateData.status !== undefined &&
            updateData.status !== existing.status

        const [updated] = await db
            .update(travelStatuses)
            .set(updateData)
            .where(eq(travelStatuses.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Estado de viaje no encontrado' },
                { status: 404 }
            )
        }

        if (nameChanged) {
            if (await enqueueStatusRenameSync('travel', Number(id))) {
                scheduleAllEnabledGoogleSheetsProcessing()
            }
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'Failed to update travel status'
        if (message.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'Ya existe un estado de viaje con ese nombre' },
                { status: 409 }
            )
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
        const [deleted] = await db
            .delete(travelStatuses)
            .where(eq(travelStatuses.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Estado de viaje no encontrado' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'Failed to delete travel status'
        if (message.includes('FOREIGN KEY')) {
            return NextResponse.json(
                {
                    error:
                        'No se puede eliminar un estado asignado a leads. Desactivalo en su lugar.'
                },
                { status: 409 }
            )
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
