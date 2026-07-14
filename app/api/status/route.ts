import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { status } from '@/db/schema'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allStatus = await db.select().from(status).orderBy(status.id)
    return NextResponse.json(allStatus)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const statusName = body.status

    if (!statusName || typeof statusName !== 'string' || !statusName.trim()) {
        return NextResponse.json(
            { error: 'Status name is required' },
            { status: 400 }
        )
    }

    try {
        const [newStatus] = await db
            .insert(status)
            .values({
                status: statusName.trim(),
                color: body.color || '#6b7280'
            })
            .returning()
        return NextResponse.json(newStatus, { status: 201 })
    } catch (error) {
        if ((error as Error)?.message?.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A status with this name already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to create status' },
            { status: 500 }
        )
    }
}
