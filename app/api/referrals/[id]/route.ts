import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { referrals } from '@/db/schema'

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
    const updateData: Record<string, string | number | null> = {}

    if (body.code !== undefined) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
            return NextResponse.json(
                { error: 'Code is required' },
                { status: 400 }
            )
        }
        updateData.code = body.code.trim()
    }

    if (body.userId !== undefined) {
        updateData.userId = body.userId
    }

    if (body.name !== undefined) {
        updateData.name = body.name || null
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(referrals)
            .set(updateData)
            .where(eq(referrals.id, Number(id)))
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Referral not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: any) {
        if (error?.message?.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A referral with this code already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to update referral' },
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
            .delete(referrals)
            .where(eq(referrals.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Referral not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to delete referral' },
            { status: 500 }
        )
    }
}
