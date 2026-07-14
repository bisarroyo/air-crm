import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, status, priority, logs, referrals } from '@/db/schema'
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

    const [row] = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            travelTime: customers.travelTime,
            statusId: customers.statusId,
            priorityId: customers.priorityId,
            assignedTo: customers.assignedTo,
            referralId: customers.referralId,
            createdAt: customers.createdAt,
            updatedAt: customers.updatedAt,
            statusName: status.status,
            statusIsActive: status.isActive,
            statusColor: status.color,
            priorityName: priority.priority,
            priorityIsActive: priority.isActive,
            priorityColor: priority.color,
            assignedUserName: user.name,
            assignedUserEmail: user.email,
            assignedUserImage: user.image
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .leftJoin(user, eq(customers.assignedTo, user.id))
        .where(eq(customers.id, Number(id)))

    if (!row) {
        return NextResponse.json(
            { error: 'Customer not found' },
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updateData: Record<string, string | number | null> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.travelTime !== undefined) updateData.travelTime = body.travelTime
    if (body.statusId !== undefined) updateData.statusId = Number(body.statusId)
    if (body.priorityId !== undefined)
        updateData.priorityId = Number(body.priorityId)
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
    if (body.referralId !== undefined) {
        updateData.referralId = body.referralId === null || body.referralId === '' || body.referralId === 0
            ? null
            : Number(body.referralId)
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [existing] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, Number(id)))
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            )
        }

        const [updated] = await db
            .update(customers)
            .set(updateData)
            .where(eq(customers.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            )
        }

        const changedFields: Record<string, { from: any; to: any }> = {}
        for (const [key, newValue] of Object.entries(updateData)) {
            const oldValue = (existing as any)[key]
            if (String(oldValue) !== String(newValue)) {
                changedFields[key] = { from: oldValue, to: newValue }
            }
        }

        if (Object.keys(changedFields).length > 0) {
            await db.insert(logs).values({
                customerId: Number(id),
                action: 'updated',
                changes: JSON.stringify(changedFields),
                userId: session.user.id
            })
        }

        return NextResponse.json(updated)
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Failed to update customer' },
            { status: 500 }
        )
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [deleted] = await db
            .delete(customers)
            .where(eq(customers.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Failed to delete customer' },
            { status: 500 }
        )
    }
}
