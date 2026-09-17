import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { tags } from '@/db/schema'

export async function resolveExistingTagIds(
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
        .select({ id: tags.id })
        .from(tags)
        .where(and(inArray(tags.id, ids), eq(tags.isActive, 1)))

    const existingSet = new Set(existing.map((t) => t.id))
    return ids.filter((id) => existingSet.has(id))
}

export async function getTagNamesByIds(
    ids: number[]
): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map()
    const rows = await db
        .select({ id: tags.id, tag: tags.tag })
        .from(tags)
        .where(inArray(tags.id, ids))
    return new Map(rows.map((t) => [t.id, t.tag]))
}