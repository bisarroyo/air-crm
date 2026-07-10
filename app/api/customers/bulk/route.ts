import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers } from '@/db/schema'

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, statusId, priorityId } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
            { error: 'No customer IDs provided' },
            { status: 400 }
        )
    }

    if (statusId === undefined && priorityId === undefined) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    const updateData: Record<string, number> = {}
    if (statusId !== undefined) updateData.statusId = Number(statusId)
    if (priorityId !== undefined)
        updateData.priorityId = Number(priorityId)

    try {
        const result = await db
            .update(customers)
            .set(updateData)
            .where(inArray(customers.id, ids))
            .returning({ id: customers.id })

        return NextResponse.json({
            success: true,
            updated: result.length
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Failed to update customers' },
            { status: 500 }
        )
    }
}
