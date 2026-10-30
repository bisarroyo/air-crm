import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { travelLeadTags, travelTags } from '@/db/schema'

export interface TravelTagOption {
    id: number
    name: string
    color: string
    isActive: number
}

export async function resolveTravelTagIds(
    tagIds: unknown
): Promise<number[]> {
    if (!Array.isArray(tagIds)) return []
    const ids = [
        ...new Set(
            tagIds
                .map(Number)
                .filter((n) => Number.isInteger(n) && n > 0)
        )
    ]
    if (ids.length === 0) return []

    const existing = await db
        .select({ id: travelTags.id })
        .from(travelTags)
        .where(and(inArray(travelTags.id, ids), eq(travelTags.isActive, 1)))

    const existingSet = new Set(existing.map((t) => t.id))
    return ids.filter((id) => existingSet.has(id))
}

export async function getTravelTagsByLeadIds(
    leadIds: number[]
): Promise<Map<number, TravelTagOption[]>> {
    const result = new Map<number, TravelTagOption[]>()
    if (leadIds.length === 0) return result

    const rows = await db
        .select({
            leadId: travelLeadTags.leadId,
            tagId: travelTags.id,
            tagName: travelTags.tag,
            tagColor: travelTags.color,
            tagIsActive: travelTags.isActive
        })
        .from(travelLeadTags)
        .innerJoin(travelTags, eq(travelLeadTags.tagId, travelTags.id))
        .where(inArray(travelLeadTags.leadId, leadIds))

    for (const row of rows) {
        const list = result.get(row.leadId) ?? []
        list.push({
            id: row.tagId,
            name: row.tagName,
            color: row.tagColor || '#6b7280',
            isActive: row.tagIsActive
        })
        result.set(row.leadId, list)
    }

    return result
}

export async function replaceTravelLeadTags(
    leadId: number,
    tagIds: unknown
) {
    const resolved = await resolveTravelTagIds(tagIds)

    await db
        .delete(travelLeadTags)
        .where(eq(travelLeadTags.leadId, leadId))

    if (resolved.length > 0) {
        await db.insert(travelLeadTags).values(
            resolved.map((tagId) => ({ leadId, tagId }))
        )
    }
}
