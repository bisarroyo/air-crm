import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { buildCatalogValues, mapRow } from './catalog-values'
export { buildCatalogValues, parseCatalogField } from './catalog-values'
import type { CatalogConfig } from './catalog-def'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

function requireAdmin() {
    return (session: { user: { role?: string | null } }) =>
        session.user.role === 'admin'
}

const tableId = (table: SQLiteTable) =>
    (table as unknown as { id: unknown }).id as never

export function createCatalogCrud(config: CatalogConfig, table: SQLiteTable) {
    async function getSession() {
        return auth.api.getSession({ headers: await headers() })
    }

    return {
        async GET() {
            const session = await getSession()
            if (!session) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                )
            }
            const rows = await db
                .select()
                .from(table)
                .orderBy(desc(tableId(table)))
            return NextResponse.json(
                rows.map((row) =>
                    mapRow(config, row as unknown as Record<string, unknown>)
                )
            )
        },

        async POST(request: Request) {
            const session = await getSession()
            if (!session || !requireAdmin()(session)) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                )
            }

            const body = (await request.json()) as Record<string, unknown>
            const { values, error } = buildCatalogValues(body, config)
            if (error) {
                return NextResponse.json({ error }, { status: 400 })
            }

            try {
                const [row] = await db
                    .insert(table)
                    .values(values)
                    .returning()
                return NextResponse.json(
                    mapRow(config, row as unknown as Record<string, unknown>),
                    { status: 201 }
                )
            } catch (err) {
                return catalogDbError(err)
            }
        }
    }
}

export function createCatalogItemCrud(
    config: CatalogConfig,
    table: SQLiteTable
) {
    async function getSession() {
        return auth.api.getSession({ headers: await headers() })
    }

    async function put(
        request: Request,
        { params }: { params: Promise<{ id: string }> }
    ) {
        const { id } = await params
        const session = await getSession()
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const body = (await request.json()) as Record<string, unknown>
        let validationBody = body
        if (config.entity === 'discounts') {
            const [existing] = await db.select().from(table).where(eq(tableId(table), Number(id))).limit(1)
            if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
            validationBody = { ...mapRow(config, existing as Record<string, unknown>), ...body }
        }
        const { values, error } = buildCatalogValues(validationBody, config, {
            partial: true
        })
        if (error) {
            return NextResponse.json({ error }, { status: 400 })
        }
        if (Object.keys(values).length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [updated] = await (db.update(table) as any)
                .set(values)
                .where(eq(tableId(table), Number(id)))
                .returning()
            if (!updated) {
                return NextResponse.json(
                    { error: 'Not found' },
                    { status: 404 }
                )
            }
            return NextResponse.json(
                mapRow(config, updated as Record<string, unknown>)
            )
        } catch (err) {
            return catalogDbError(err)
        }
    }

    return {
        PUT: put,

        async DELETE(
            _request: Request,
            { params }: { params: Promise<{ id: string }> }
        ) {
            const { id } = await params
            const session = await getSession()
            if (!session || session.user.role !== 'admin') {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                )
            }

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const [deleted] = await (db.delete(table) as any)
                    .where(eq(tableId(table), Number(id)))
                    .returning()
                if (!deleted) {
                    return NextResponse.json(
                        { error: 'Not found' },
                        { status: 404 }
                    )
                }
                return NextResponse.json(deleted)
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err)
                if (message.includes('FOREIGN KEY')) {
                    return NextResponse.json(
                        {
                            error:
                                'No se puede eliminar porque está en uso. Desactívalo en su lugar.'
                        },
                        { status: 409 }
                    )
                }
                return catalogDbError(err)
            }
        }
    }
}

export function catalogDbError(err: unknown): NextResponse {
    const message =
        err instanceof Error ? err.message : 'Database error'
    if (message.includes('UNIQUE')) {
        return NextResponse.json(
            { error: 'Ya existe un registro con ese nombre' },
            { status: 409 }
        )
    }
    if (message.includes('FOREIGN KEY')) {
        return NextResponse.json(
            { error: 'Registro en uso por otros elementos' },
            { status: 409 }
        )
    }
    return NextResponse.json({ error: message }, { status: 500 })
}