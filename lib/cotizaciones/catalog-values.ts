import { parseDateInput, toDateInputValue } from './shared'
import type { CatalogConfig, CatalogField } from './catalog-def'

type ParseResult =
    | { ok: true; value: unknown }
    | { ok: false; error: string }

function parseNumberField(raw: unknown, field: CatalogField): ParseResult {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
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
        return { ok: true, value: field.type === 'date' ? null : undefined }
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
            if (field.options && !field.options.some((option) => option.value === String(raw))) {
                return { ok: false, error: `${field.label} no es válido` }
            }
            if (field.numeric) {
                const n = Number(raw)
                if (!Number.isFinite(n)) {
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
    if (config.entity === 'discounts') {
        const value = Number(body.value)
        if ((!partial || body.value !== undefined) && (!Number.isFinite(value) || value <= 0 || (body.type === 'percent' && value > 100))) {
            return { values, error: 'El descuento debe ser positivo y el porcentaje no puede superar 100%' }
        }
        if (body.startsAt && body.endsAt && String(body.startsAt) > String(body.endsAt)) {
            return { values, error: 'La fecha de vencimiento no puede ser anterior al inicio' }
        }
    }
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

        if (partial && raw === undefined) {
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
            const date = parseDateInput(raw)
            if (date) {
                values[key] = date
            } else {
                return { values, error: 'Fecha no válida' }
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

export function mapRow(config: CatalogConfig, row: Record<string, unknown>) {
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

