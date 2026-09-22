import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerTasks } from '@/db/schema'
import { user } from '@/auth-schema'

const URGENCIES = ['low', 'medium', 'high']

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
            id: customerTasks.id,
            title: customerTasks.title,
            description: customerTasks.description,
            dueDate: customerTasks.dueDate,
            urgency: customerTasks.urgency,
            isCompleted: customerTasks.isCompleted,
            completedAt: customerTasks.completedAt,
            createdAt: customerTasks.createdAt,
            userId: customerTasks.userId,
            userName: user.name,
            userEmail: user.email
        })
        .from(customerTasks)
        .leftJoin(user, eq(customerTasks.userId, user.id))
        .where(eq(customerTasks.customerId, Number(id)))

    const urgencyWeight = { high: 0, medium: 1, low: 2 }
    rows.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1
        if (a.urgency !== b.urgency) {
            return urgencyWeight[a.urgency] - urgencyWeight[b.urgency]
        }
        const aTime = a.dueDate ? a.dueDate.getTime() : 0
        const bTime = b.dueDate ? b.dueDate.getTime() : 0
        if (a.dueDate && b.dueDate) return aTime - bTime
        if (a.dueDate && !b.dueDate) return -1
        return 1
    })

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
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
        return NextResponse.json(
            { error: 'Title is required' },
            { status: 400 }
        )
    }

    const urgency = URGENCIES.includes(body.urgency)
        ? body.urgency
        : 'medium'

    let dueDate: Date | null = null
    if (body.dueDate) {
        const parsed = new Date(body.dueDate)
        if (!Number.isNaN(parsed.getTime())) {
            dueDate = parsed
        }
    }

    try {
        const [created] = await db
            .insert(customerTasks)
            .values({
                customerId: Number(id),
                title,
                description:
                    typeof body.description === 'string'
                        ? body.description.trim() || null
                        : null,
                dueDate,
                urgency,
                userId: session.user.id
            })
            .returning()

        return NextResponse.json(created, { status: 201 })
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to create task' },
            { status: 500 }
        )
    }
}