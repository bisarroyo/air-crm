import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
    customers,
    status,
    priority,
    logs,
    customerTags,
    tags
} from '@/db/schema'
import { user } from '@/auth-schema'
import { getTagNamesByIds, resolveExistingTagIds } from '@/lib/tags'

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

    const [row] = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            travelTime: customers.travelTime,
            statusId: customers.statusId,
            priorityId: customers.priorityId,
            assignedTo: customers.assignedTo,
            referralId: customers.referralId,
            createdAt: customers.createdAt,
            updatedAt: customers.updatedAt,
            statusName: status.status,
            statusIsActive: status.isActive,
            statusColor: status.color,
            priorityName: priority.priority,
            priorityIsActive: priority.isActive,
            priorityColor: priority.color,
            assignedUserName: user.name,
            assignedUserEmail: user.email,
            assignedUserImage: user.image
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .leftJoin(user, eq(customers.assignedTo, user.id))
        .where(eq(customers.id, Number(id)))

    if (!row) {
        return NextResponse.json(
            { error: 'Customer not found' },
            { status: 404 }
        )
    }

    const tagRows = await db
        .select({
            customerId: customerTags.customerId,
            tagId: tags.id,
            tagName: tags.tag,
            tagColor: tags.color,
            tagIsActive: tags.isActive
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(eq(customerTags.customerId, Number(id)))

    return NextResponse.json({
        ...row,
        tags: tagRows.map((t) => ({
            id: t.tagId,
            name: t.tagName,
            color: t.tagColor || '#6b7280',
            isActive: t.tagIsActive
        }))
    })
}

export async function PUT(
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
    const updateData: Record<string, string | number | null> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.travelTime !== undefined) updateData.travelTime = body.travelTime
    if (body.statusId !== undefined) updateData.statusId = Number(body.statusId)
    if (body.priorityId !== undefined)
        updateData.priorityId = Number(body.priorityId)
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
    if (body.referralId !== undefined) {
        updateData.referralId = body.referralId === null || body.referralId === '' || body.referralId === 0
            ? null
            : Number(body.referralId)
    }

    const hasTagChange = body.tagIds !== undefined

    if (Object.keys(updateData).length === 0 && !hasTagChange) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [existing] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, Number(id)))
            .limit(1)

        if (!existing) {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            )
        }

        let updatedContact = existing
        if (Object.keys(updateData).length > 0) {
            const [updated] = await db
                .update(customers)
                .set(updateData)
                .where(eq(customers.id, Number(id)))
                .returning()

            if (!updated) {
                return NextResponse.json(
                    { error: 'Customer not found' },
                    { status: 404 }
                )
            }
            updatedContact = updated
        }

        const changedFields: Record<
            string,
            {
                from: string | number | Date | null | undefined
                to: string | number | Date | null | undefined
            } | { from: string[]; to: string[] }
        > = {}
        for (const [key, newValue] of Object.entries(updateData)) {
            const oldValue = existing[key as keyof typeof existing]
            if (String(oldValue) !== String(newValue)) {
                changedFields[key] = { from: oldValue, to: newValue }
            }
        }

        if (hasTagChange) {
            const existingTagRows = await db
                .select({ tagId: customerTags.tagId })
                .from(customerTags)
                .where(eq(customerTags.customerId, Number(id)))
            const existingTagIds = existingTagRows.map((t) => t.tagId)
            const desiredTagIds = await resolveExistingTagIds(body.tagIds)

            const removed = existingTagIds.filter(
                (tid) => !desiredTagIds.includes(tid)
            )
            const added = desiredTagIds.filter(
                (tid) => !existingTagIds.includes(tid)
            )

            if (removed.length > 0) {
                await db
                    .delete(customerTags)
                    .where(
                        and(
                            eq(customerTags.customerId, Number(id)),
                            inArray(customerTags.tagId, removed)
                        )
                    )
            }
            if (added.length > 0) {
                await db.insert(customerTags).values(
                    added.map((tagId) => ({
                        customerId: Number(id),
                        tagId
                    }))
                )
            }

            if (added.length > 0 || removed.length > 0) {
                const nameMap = await getTagNamesByIds([
                    ...existingTagIds,
                    ...desiredTagIds
                ])
                const names = (ids: number[]) =>
                    ids
                        .map((tid) => nameMap.get(tid))
                        .filter((n): n is string => Boolean(n))
                changedFields.tags = {
                    from: names(existingTagIds),
                    to: names(desiredTagIds)
                }
            }
        }

        if (Object.keys(changedFields).length > 0) {
            await db.insert(logs).values({
                customerId: Number(id),
                action: 'updated',
                changes: JSON.stringify(changedFields),
                userId: session.user.id
            })
        }

        return NextResponse.json(updatedContact)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to update customer' },
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
            .delete(customers)
            .where(eq(customers.id, Number(id)))
            .returning()

        if (!deleted) {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(deleted)
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json(
            { error: err?.message || 'Failed to delete customer' },
            { status: 500 }
        )
    }
}
