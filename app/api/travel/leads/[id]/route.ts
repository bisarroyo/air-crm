import { canAccessLeads } from '@/lib/organization-access'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { travelLeads, travelStatuses } from '@/db/schema'
import {
    enqueueLeadSync,
    getOrganizationId,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

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
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    const [row] = await db
        .select({
            id: travelLeads.id,
            name: travelLeads.name,
            phone: travelLeads.phone,
            email: travelLeads.email,
            metaInboxUrl: travelLeads.metaInboxUrl,
            statusId: travelLeads.statusId,
            createdAt: travelLeads.createdAt,
            updatedAt: travelLeads.updatedAt,
            statusName: travelStatuses.status,
            statusIsActive: travelStatuses.isActive,
            statusColor: travelStatuses.color
        })
        .from(travelLeads)
        .leftJoin(travelStatuses, eq(travelLeads.statusId, travelStatuses.id))
        .where(eq(travelLeads.id, Number(id)))

    if (!row) {
        return NextResponse.json(
            { error: 'Lead de viaje no encontrado' },
            { status: 404 }
        )
    }

    return NextResponse.json(row)
}

export async function PUT(
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
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, string | number | Date | null> = {}

    if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name) {
            return NextResponse.json(
                { error: 'El nombre es obligatorio' },
                { status: 400 }
            )
        }
        updateData.name = name
    }
    if (body.phone !== undefined) updateData.phone = String(body.phone).trim()
    if (body.email !== undefined) updateData.email = String(body.email).trim()
    if (body.metaInboxUrl !== undefined) {
        updateData.metaInboxUrl =
            typeof body.metaInboxUrl === 'string' && body.metaInboxUrl.trim()
                ? body.metaInboxUrl.trim()
                : null
    }
    if (body.statusId !== undefined) updateData.statusId = Number(body.statusId)

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No hay campos para actualizar' },
            { status: 400 }
        )
    }

    try {
        const [existing] = await db
            .select()
            .from(travelLeads)
            .where(eq(travelLeads.id, Number(id)))
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Lead de viaje no encontrado' },
                { status: 404 }
            )
        }

        if (
            updateData.statusId !== undefined &&
            Number(updateData.statusId) !== existing.statusId
        ) {
            updateData.statusChangedAt = new Date()
        }

        const [updated] = await db
            .update(travelLeads)
            .set(updateData)
            .where(eq(travelLeads.id, Number(id)))
            .returning()

        const sheetChanged = ['name', 'phone', 'email', 'statusId'].some(
            (field) => field in updateData
        )

        if (sheetChanged) {
            const organizationId = await getOrganizationId(session)
            if (
                await enqueueLeadSync(
                    organizationId,
                    'travel',
                    Number(id)
                )
            ) {
                scheduleGoogleSheetsProcessing(organizationId)
            }
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo actualizar el lead'
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
    if (!(await canAccessLeads(session, 'travel', [Number(id)]))) {
        return NextResponse.json({ error: 'Lead no encontrado en la organización activa' }, { status: 404 })
    }

    try {
        const [deleted] = await db
            .delete(travelLeads)
            .where(eq(travelLeads.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Lead de viaje no encontrado' },
                { status: 404 }
            )
        }

        const organizationId = await getOrganizationId(session)
        if (
            await enqueueLeadSync(
                organizationId,
                'travel',
                deleted.id,
                'delete'
            )
        ) {
            scheduleGoogleSheetsProcessing(organizationId)
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'No se pudo eliminar el lead'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
