import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { tags } from '@/db/schema'

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

    if (body.tag !== undefined) {
        if (typeof body.tag !== 'string' || !body.tag.trim()) {
            return NextResponse.json(
                { error: 'Tag name is required' },
                { status: 400 }
            )
        }
        updateData.tag = body.tag.trim()
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
            .update(tags)
            .set(updateData)
            .where(eq(tags.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Tag not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update tag'
        if (message.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A tag with this name already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: message },
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
            .delete(tags)
            .where(eq(tags.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Tag not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete tag'
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}