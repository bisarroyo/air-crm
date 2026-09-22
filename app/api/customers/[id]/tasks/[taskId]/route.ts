import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customerTasks } from '@/db/schema'

const URGENCIES = ['low', 'medium', 'high']

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    const { id, taskId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const [existing] = await db
        .select()
        .from(customerTasks)
        .where(
            and(
                eq(customerTasks.id, Number(taskId)),
                eq(customerTasks.customerId, Number(id))
            )
        )
        .limit(1)

    if (!existing) {
        return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
        )
    }

    const updateData: Record<string, string | number | Date | null> = {}

    if (body.title !== undefined) {
        const title = typeof body.title === 'string' ? body.title.trim() : ''
        if (!title) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            )
        }
        updateData.title = title
    }

    if (body.description !== undefined) {
        updateData.description =
            typeof body.description === 'string'
                ? body.description.trim() || null
                : null
    }

    if (body.urgency !== undefined) {
        if (!URGENCIES.includes(body.urgency)) {
            return NextResponse.json(
                { error: 'Invalid urgency' },
                { status: 400 }
            )
        }
        updateData.urgency = body.urgency
    }

    if (body.dueDate !== undefined) {
        updateData.dueDate =
            body.dueDate === null
                ? null
                : new Date(body.dueDate)
        if (updateData.dueDate && Number.isNaN(updateData.dueDate.getTime())) {
            updateData.dueDate = null
        }
    }

    if (body.isCompleted !== undefined) {
        const isCompleted = Boolean(body.isCompleted)
        updateData.isCompleted = isCompleted ? 1 : 0
        updateData.completedAt = isCompleted ? new Date() : null
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(customerTasks)
            .set(updateData)
            .where(
                and(
                    eq(customerTasks.id, Number(taskId)),
                    eq(customerTasks.customerId, Number(id))
                )
            )
            .returning()

        if (!updated) {
            return NextResponse.json(
                { error: 'Task not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(updated)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to update task' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    const { id, taskId } = await params
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [deleted] = await db
            .delete(customerTasks)
            .where(
                and(
                    eq(customerTasks.id, Number(taskId)),
                    eq(customerTasks.customerId, Number(id))
                )
            )
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Task not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to delete task' },
            { status: 500 }
        )
    }
}