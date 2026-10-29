import { SheetsError } from './google-sheets-transport'

export const LEAD_FIELDS = [
    'name',
    'phone',
    'email',
    'notes',
    'status'
] as const

export type LeadField = (typeof LEAD_FIELDS)[number]

export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
    name: 'Nombre',
    phone: 'Teléfono',
    email: 'Correo',
    notes: 'Notas',
    status: 'Estado'
}

export const LEAD_FIELD_DESCRIPTIONS: Record<LeadField, string> = {
    name: 'Nombre del contacto o del lead de viaje.',
    phone: 'Teléfono tal como fue registrado.',
    email: 'Correo electrónico.',
    notes: 'Notas ordenadas de más reciente a más antigua.',
    status: 'Nombre legible del estado actual.'
}

export function isLeadField(value: unknown): value is LeadField {
    return (
        typeof value === 'string' &&
        (LEAD_FIELDS as readonly string[]).includes(value)
    )
}

/** Empty/null means all fields, which keeps legacy rows compatible. */
export function parseLeadFields(
    value: string | null | undefined
): LeadField[] {
    if (!value) return [...LEAD_FIELDS]
    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) return [...LEAD_FIELDS]
        const selected = LEAD_FIELDS.filter((field) => parsed.includes(field))
        return selected.length ? selected : [...LEAD_FIELDS]
    } catch {
        return [...LEAD_FIELDS]
    }
}

export function normalizeLeadFields(value: unknown): LeadField[] | undefined {
    if (value === undefined) return undefined
    if (!Array.isArray(value)) {
        throw new SheetsError('La selección de campos no es válida.')
    }
    const selected = LEAD_FIELDS.filter((field) => value.includes(field))
    if (!selected.length) {
        throw new SheetsError('Seleccioná al menos un campo para sincronizar.')
    }
    return selected
}

/** Store null when every field is exported, which is the default. */
export function serializeLeadFields(fields: LeadField[]): string | null {
    return fields.length === LEAD_FIELDS.length ? null : JSON.stringify(fields)
}

export function sameLeadFields(a: LeadField[], b: LeadField[]): boolean {
    return a.length === b.length && a.every((field, index) => field === b[index])
}
