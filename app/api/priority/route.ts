import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { priority } from '@/db/schema'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allPriority = await db.select().from(priority).orderBy(priority.id)
    return NextResponse.json(allPriority)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const priorityName = body.priority

    if (
        !priorityName ||
        typeof priorityName !== 'string' ||
        !priorityName.trim()
    ) {
        return NextResponse.json(
            { error: 'Priority name is required' },
            { status: 400 }
        )
    }

    try {
        const [newPriority] = await db
            .insert(priority)
            .values({
                priority: priorityName.trim(),
                color: body.color || '#6b7280'
            })
            .returning()
        return NextResponse.json(newPriority, { status: 201 })
    } catch (error) {
        if ((error as Error)?.message?.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'A priority with this name already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to create priority' },
            { status: 500 }
        )
    }
}
