import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers, status, priority } from '@/db/schema'
import { user } from '@/auth-schema'

export interface CustomerDetail {
    id: number
    name: string
    phone: string
    email: string
    travelTime: string
    country: string | null
    statusId: number
    priorityId: number
    assignedTo: string
    referralId: number | null
    createdAt: string | null
    updatedAt: string | null
    statusName: string | null
    statusIsActive: number | null
    statusColor: string | null
    priorityName: string | null
    priorityIsActive: number | null
    priorityColor: string | null
    assignedUserName: string | null
    assignedUserEmail: string | null
    assignedUserImage: string | null
    tags: Array<{
        id: number
        name: string
        color: string
        isActive: number
    }>
}

export async function getCustomerDetail(customerId: number): Promise<CustomerDetail | null> {
    const [row] = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            travelTime: customers.travelTime,
            country: customers.country,
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
        .where(eq(customers.id, customerId))

    if (!row) return null

    const { customerTags, tags } = await import('@/db/schema')
    const { eq: eq2 } = await import('drizzle-orm')

    const tagRows = await db
        .select({
            customerId: customerTags.customerId,
            tagId: tags.id,
            tagName: tags.tag,
            tagColor: tags.color,
            tagIsActive: tags.isActive
        })
        .from(customerTags)
        .innerJoin(tags, eq2(customerTags.tagId, tags.id))
        .where(eq2(customerTags.customerId, customerId))

    return {
        ...row,
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
        tags: tagRows.map((t) => ({
            id: t.tagId,
            name: t.tagName,
            color: t.tagColor || '#6b7280',
            isActive: t.tagIsActive
        }))
    }
}