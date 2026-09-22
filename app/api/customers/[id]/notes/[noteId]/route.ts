import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerNotes } from '@/db/schema'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; noteId: string }> }
) {
    const { id, noteId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) {
        return NextResponse.json(
            { error: 'Note is required' },
            { status: 400 }
        )
    }

    try {
        const [existing] = await db
            .select()
            .from(customerNotes)
            .where(
                and(
                    eq(customerNotes.id, Number(noteId)),
                    eq(customerNotes.customerId, Number(id))
                )
            )
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Note not found' },
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

        const [updated] = await db
            .update(customerNotes)
            .set({ note })
            .where(
                and(
                    eq(customerNotes.id, Number(noteId)),
                    eq(customerNotes.customerId, Number(id))
                )
            )
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Note not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to update note' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string; noteId: string }> }
) {
    const { id, noteId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [existing] = await db
            .select()
            .from(customerNotes)
            .where(
                and(
                    eq(customerNotes.id, Number(noteId)),
                    eq(customerNotes.customerId, Number(id))
                )
            )
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Note not found' },
                { status: 404 }
            )
        }

        if (existing.userId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            )
        }

        const [deleted] = await db
            .delete(customerNotes)
            .where(
                and(
                    eq(customerNotes.id, Number(noteId)),
                    eq(customerNotes.customerId, Number(id))
                )
            )
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Note not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to delete note' },
            { status: 500 }
        )
    }
}