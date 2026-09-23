import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
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

async function schoolIdsFor(includeId: number): Promise<number[]> {
    const rows = await db
        .select({ schoolId: quotationSchoolIncludeSchools.schoolId })
        .from(quotationSchoolIncludeSchools)
        .where(eq(quotationSchoolIncludeSchools.includeId, includeId))
    return rows.map((row) => row.schoolId)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await getSession()
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotationId = Number(id)
    if (!Number.isFinite(quotationId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const values: Record<string, unknown> = {}

    if (body.name !== undefined) {
        const name = String(body.name).trim()
        if (!name) {
            return NextResponse.json(
                { error: 'Nombre es requerido' },
                { status: 400 }
            )
        }
        values.name = name
    }
    if (body.description !== undefined) {
        values.description =
            typeof body.description === 'string'
                ? body.description.trim()
                : null
    }
    if (body.isActive !== undefined) {
        values.isActive =
            body.isActive === true ||
            body.isActive === 1 ||
            body.isActive === '1' ||
            body.isActive === 'true'
                ? 1
                : 0
    }

    const hasSchoolIds = body.schoolIds !== undefined
    const schoolIds = isNumberArray(body.schoolIds)
        ? body.schoolIds.map(Number)
        : []
    if (hasSchoolIds && !isNumberArray(body.schoolIds)) {
        return NextResponse.json(
            { error: 'Las escuelas seleccionadas no son válidas' },
            { status: 400 }
        )
    }
    if (hasSchoolIds && schoolIds.length === 0) {
        return NextResponse.json(
            { error: 'Debes seleccionar al menos una escuela' },
            { status: 400 }
        )
    }

    if (Object.keys(values).length === 0 && !hasSchoolIds) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        if (Object.keys(values).length > 0) {
            const [updated] = await (
                db.update(quotationSchoolIncludes) as unknown as {
                    set: (
                        v: Record<string, unknown>
                    ) => {
                        where: (
                            c: unknown
                        ) => {
                            returning: () => Promise<unknown[]>
                        }
                    }
                }
            )
                .set(values)
                .where(eq(quotationSchoolIncludes.id, quotationId))
                .returning()
            if (!updated) {
                return NextResponse.json(
                    { error: 'Not found' },
                    { status: 404 }
                )
            }
        }

        if (hasSchoolIds && schoolIds.length > 0) {
            await db
                .delete(quotationSchoolIncludeSchools)
                .where(eq(quotationSchoolIncludeSchools.includeId, quotationId))
            await db.insert(quotationSchoolIncludeSchools).values(
                schoolIds.map((schoolId) => ({
                    includeId: quotationId,
                    schoolId
                }))
            )
        }

        const [row] = await db
            .select()
            .from(quotationSchoolIncludes)
            .where(eq(quotationSchoolIncludes.id, quotationId))
            .limit(1)
        if (!row) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...row,
            schoolIds: await schoolIdsFor(quotationId)
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await getSession()
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotationId = Number(id)
    if (!Number.isFinite(quotationId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
        const [deleted] = await (
            db.delete(quotationSchoolIncludes) as unknown as {
                where: (
                    c: unknown
                ) => { returning: () => Promise<unknown[]> }
            }
        )
            .where(eq(quotationSchoolIncludes.id, quotationId))
            .returning()
        if (!deleted) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        return NextResponse.json(deleted)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}