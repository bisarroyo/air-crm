import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerNotes } from '@/db/schema'
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

    const rows = await db
        .select({
            id: customerNotes.id,
            note: customerNotes.note,
            createdAt: customerNotes.createdAt,
            userId: customerNotes.userId,
            userName: user.name,
            userEmail: user.email
        })
        .from(customerNotes)
        .leftJoin(user, eq(customerNotes.userId, user.id))
        .where(eq(customerNotes.customerId, Number(id)))
        .orderBy(desc(customerNotes.createdAt))

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
        const [created] = await db
            .insert(customerNotes)
            .values({
                customerId: Number(id),
                note,
                userId: session.user.id
            })
            .returning()

        return NextResponse.json(created, { status: 201 })
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to create note' },
            { status: 500 }
        )
    }
}