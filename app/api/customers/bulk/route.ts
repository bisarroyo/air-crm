import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, logs, customerTags } from '@/db/schema'
import { getTagNamesByIds, resolveExistingTagIds } from '@/lib/tags'

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, statusId, priorityId, assignedTo, tagIds } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
            { error: 'No customer IDs provided' },
            { status: 400 }
        )
    }

    const hasTagChange = Array.isArray(tagIds) && tagIds.length > 0

    if (statusId === undefined && priorityId === undefined && assignedTo === undefined && !hasTagChange) {
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

        let desiredTagIds: number[] = []
        const tagsByCustomer = new Map<number, number[]>()
        let tagNameMap = new Map<number, string>()

        if (hasTagChange) {
            desiredTagIds = await resolveExistingTagIds(tagIds)
            if (desiredTagIds.length > 0) {
                tagNameMap = await getTagNamesByIds(desiredTagIds)

                const existingTagRows = await db
                    .select()
                    .from(customerTags)
                    .where(inArray(customerTags.customerId, ids))

                const existingByCustomer = new Map<number, Set<number>>()
                for (const r of existingTagRows) {
                    const set = existingByCustomer.get(r.customerId) || new Set<number>()
                    set.add(r.tagId)
                    existingByCustomer.set(r.customerId, set)
                }

                const toInsert: { customerId: number; tagId: number }[] = []
                for (const c of existingCustomers) {
                    const current = existingByCustomer.get(c.id) || new Set<number>()
                    const added = desiredTagIds.filter((tid) => !current.has(tid))
                    if (added.length > 0) {
                        tagsByCustomer.set(c.id, added)
                        for (const tid of added) {
                            toInsert.push({ customerId: c.id, tagId: tid })
                        }
                    }
                }

                if (toInsert.length > 0) {
                    await db.insert(customerTags).values(toInsert)
                }
            }
        }

        const result = await db
            .update(customers)
            .set(updateData)
            .where(inArray(customers.id, ids))
            .returning({ id: customers.id })

        const logEntries = result.map(r => {
                const existing = existingMap.get(r.id)
                if (!existing) return null

                const changedFields: Record<
                    string,
                    { from: string | number | Date | null | undefined; to: string | number | Date | null | undefined } | { from: string[]; to: string[] }
                > = {}
                for (const [key, newValue] of Object.entries(updateData)) {
                    const oldValue = existing[key as keyof typeof existing]
                    if (String(oldValue) !== String(newValue)) {
                        changedFields[key] = { from: oldValue, to: newValue }
                    }
                }

                const addedTagIds = tagsByCustomer.get(r.id)
                if (addedTagIds && addedTagIds.length > 0) {
                    changedFields.tags = {
                        from: [],
                        to: addedTagIds
                            .map((tid) => tagNameMap.get(tid))
                            .filter((n): n is string => Boolean(n))
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
