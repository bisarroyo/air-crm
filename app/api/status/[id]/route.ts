import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { status } from '@/db/schema'

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

    if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !body.status.trim()) {
            return NextResponse.json(
                { error: 'Status name is required' },
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
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(status)
            .set(updateData)
            .where(eq(status.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Status not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: any) {
        if (error?.message?.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A status with this name already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to update status' },
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
            .delete(status)
            .where(eq(status.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Status not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: any) {
        if (error?.message?.includes('FOREIGN KEY')) {
            return NextResponse.json(
                {
                    error:
                        'Cannot delete status assigned to customers. Deactivate it instead.'
                },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to delete status' },
            { status: 500 }
        )
    }
}
