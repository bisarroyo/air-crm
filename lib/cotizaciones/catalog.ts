import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { toDateInputValue } from './shared'
import type { CatalogConfig, CatalogField } from './catalog-def'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

type ParseResult =
    | { ok: true; value: unknown }
    | { ok: false; error: string }

function parseNumberField(raw: unknown, field: CatalogField): ParseResult {
    const n = Number(raw)
    if (Number.isNaN(n)) {
        return { ok: false, error: `${field.label} debe ser un número` }
    }
    if (field.min !== undefined && n < field.min) {
        return {
            ok: false,
            error: `${field.label} no puede ser menor que ${field.min}`
        }
    }
    if (field.max !== undefined && n > field.max) {
        return {
            ok: false,
            error: `${field.label} no puede ser mayor que ${field.max}`
        }
    }
    return { ok: true, value: n }
}

function isActiveValue(raw: unknown): number {
    return raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0
}

export function parseCatalogField(
    field: CatalogField,
    raw: unknown,
    appliedDefault: boolean
): ParseResult {
    if (raw === undefined || raw === null || raw === '') {
        if (field.required && !appliedDefault) {
            return { ok: false, error: `${field.label} es requerido` }
        }
        return { ok: true, value: undefined }
    }

    switch (field.type) {
        case 'text':
        case 'textarea':
        case 'image':
            return { ok: true, value: String(raw).trim() }
        case 'number':
            return parseNumberField(raw, field)
        case 'switch':
            return { ok: true, value: isActiveValue(raw) }
        case 'date':
            return { ok: true, value: String(raw).trim() }
        case 'select': {
            if (field.numeric) {
                const n = Number(raw)
                if (Number.isNaN(n)) {
                    return { ok: false, error: `${field.label} no es válido` }
                }
                return { ok: true, value: n }
            }
            return { ok: true, value: String(raw).trim() }
        }
        default:
            return { ok: true, value: String(raw) }
    }
}

export interface CatalogValuesResult {
    values: Record<string, unknown>
    error: string | null
}

/**
 * Validates a request body against a catalog config and builds the column
 * values to persist. When `partial` is true only provided fields are parsed.
 */
export function buildCatalogValues(
    body: Record<string, unknown>,
    config: CatalogConfig,
    { partial = false }: { partial?: boolean } = {}
): CatalogValuesResult {
    const values: Record<string, unknown> = {}
    const dateFields: Array<{ key: string; field: CatalogField }> = []

    for (const field of config.fields) {
        let raw = body[field.key]
        let appliedDefault = false

        if ((raw === undefined || raw === null || raw === '') && !partial) {
            if (field.default !== undefined && field.default !== null) {
                raw = field.default
                appliedDefault = true
            }
        }

        if (partial && (raw === undefined || raw === null)) {
            continue
        }

        const result = parseCatalogField(field, raw, appliedDefault)
        if (!result.ok) {
            return { values, error: result.error }
        }
        if (result.value !== undefined) {
            if (field.type === 'date') {
                dateFields.push({ key: field.key, field })
            }
            values[field.key] = result.value
        }
    }

    for (const { key } of dateFields) {
        const raw = values[key]
        if (typeof raw === 'string' && raw) {
            const date = new Date(`${raw}T00:00:00`)
            if (!Number.isNaN(date.getTime())) {
                values[key] = date
            } else {
                values[key] = null
            }
        } else {
            values[key] = null
        }
    }

    // Convert euros to cents for storage
    for (const field of config.fields) {
        if (
            (field.format === 'euros' || field.format === 'cents') &&
            values[field.key] !== undefined
        ) {
            const v = values[field.key]
            if (typeof v === 'number') {
                const target = field.dbKey ?? field.key
                values[target] = Math.round(v * 100)
                if (target !== field.key) {
                    delete values[field.key]
                }
            }
        }
    }

    return { values, error: null }
}

function mapRow(config: CatalogConfig, row: Record<string, unknown>) {
    const out: Record<string, unknown> = { ...row }
    for (const field of config.fields) {
        if (field.type === 'date') {
            const v = out[field.key]
            out[field.key] =
                v instanceof Date ? toDateInputValue(v) : (v ?? null)
        }
        // Convert cents to euros for display
        if (field.format === 'euros' || field.format === 'cents') {
            const v = out[field.dbKey ?? field.key]
            if (typeof v === 'number') {
                out[field.key] = v / 100
            }
        }
    }
    return out
}

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
        const { values, error } = buildCatalogValues(body, config, {
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