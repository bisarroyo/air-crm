import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
    quotationSchoolIncludes,
    quotationSchoolIncludeSchools
} from '@/db/schema'

async function getSession() {
    return auth.api.getSession({ headers: await headers() })
}

function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((v) => Number.isFinite(Number(v)))
}

function normalizeIsActive(value: unknown): number {
    return value === true || value === 1 || value === '1' || value === 'true'
        ? 1
        : 0
}

async function listWithLinks() {
    const rows = await db
        .select()
        .from(quotationSchoolIncludes)
        .orderBy(desc(quotationSchoolIncludes.id))

    if (rows.length === 0) return []

    const links = await db
        .select()
        .from(quotationSchoolIncludeSchools)
        .where(
            inArray(
                quotationSchoolIncludeSchools.includeId,
                rows.map((row) => row.id)
            )
        )

    const byInclude = new Map<number, number[]>()
    for (const link of links) {
        const ids = byInclude.get(link.includeId) ?? []
        ids.push(link.schoolId)
        byInclude.set(link.includeId, ids)
    }

    return rows.map((row) => ({
        ...row,
        schoolIds: byInclude.get(row.id) ?? []
    }))
}

export async function GET() {
    const session = await getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(await listWithLinks())
}

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
        return NextResponse.json(
            { error: 'Nombre es requerido' },
            { status: 400 }
        )
    }
    const schoolIds = isNumberArray(body.schoolIds)
        ? body.schoolIds.map(Number)
        : []
    if (schoolIds.length === 0) {
        return NextResponse.json(
            { error: 'Debes seleccionar al menos una escuela' },
            { status: 400 }
        )
    }

    try {
        const [created] = await db
            .insert(quotationSchoolIncludes)
            .values({
                name,
                description:
                    typeof body.description === 'string'
                        ? body.description.trim()
                        : null,
                isActive: normalizeIsActive(body.isActive)
            })
            .returning()

        if (schoolIds.length > 0) {
            await db.insert(quotationSchoolIncludeSchools).values(
                schoolIds.map((schoolId) => ({
                    includeId: created.id,
                    schoolId
                }))
            )
        }

        return NextResponse.json(
            { ...created, schoolIds },
            { status: 201 }
        )
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}