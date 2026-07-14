import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, logs } from '@/db/schema'

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, statusId, priorityId, assignedTo } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
            { error: 'No customer IDs provided' },
            { status: 400 }
        )
    }

    if (statusId === undefined && priorityId === undefined && assignedTo === undefined) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    const updateData: Record<string, string | number> = {}
    if (statusId !== undefined) updateData.statusId = Number(statusId)
    if (priorityId !== undefined)
        updateData.priorityId = Number(priorityId)
    if (assignedTo !== undefined)
        updateData.assignedTo = assignedTo

    try {
        const existingCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.id, ids))

        const existingMap = new Map(
            existingCustomers.map(c => [c.id, c])
        )

        const result = await db
            .update(customers)
            .set(updateData)
            .where(inArray(customers.id, ids))
            .returning({ id: customers.id })

        const logEntries = result
            .map(r => {
                const existing = existingMap.get(r.id)
                if (!existing) return null

                const changedFields: Record<
                    string,
                    { from: string | number | Date | null | undefined; to: string | number | Date | null | undefined }
                > = {}
                for (const [key, newValue] of Object.entries(updateData)) {
                    const oldValue = existing[key as keyof typeof existing]
                    if (String(oldValue) !== String(newValue)) {
                        changedFields[key] = { from: oldValue, to: newValue }
                    }
                }

                if (Object.keys(changedFields).length === 0) return null

                return {
                    customerId: r.id,
                    action: 'bulk_updated',
                    changes: JSON.stringify(changedFields),
                    userId: session.user.id
                }
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

        if (logEntries.length > 0) {
            await db.insert(logs).values(logEntries)
        }

        return NextResponse.json({
            success: true,
            updated: result.length
        })
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to update customers' },
            { status: 500 }
        )
    }
}
