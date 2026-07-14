import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { priority } from '@/db/schema'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updateData: Record<string, string | number> = {}

    if (body.priority !== undefined) {
        if (typeof body.priority !== 'string' || !body.priority.trim()) {
            return NextResponse.json(
                { error: 'Priority name is required' },
                { status: 400 }
            )
        }
        updateData.priority = body.priority.trim()
    }

    if (body.color !== undefined) {
        updateData.color = body.color
    }

    if (body.isActive !== undefined) {
        updateData.isActive = body.isActive ? 1 : 0
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(priority)
            .set(updateData)
            .where(eq(priority.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Priority not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A priority with this name already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to update priority' },
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
            .delete(priority)
            .where(eq(priority.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Priority not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('FOREIGN KEY')) {
            return NextResponse.json(
                {
                    error:
                        'Cannot delete priority assigned to customers. Deactivate it instead.'
                },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to delete priority' },
            { status: 500 }
        )
    }
}