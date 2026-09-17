export const IMPORT_MAX_ROWS = 500

export const TRAVEL_TIME_VALUES = ['0-3', '3-6', '6-12', '12-18', '0'] as const

export const TRAVEL_TIME_LABELS: Record<string, string> = {
    '0-3': 'Lo antes posible',
    '3-6': 'En 3-6 meses',
    '6-12': 'En 6-12 meses',
    '12-18': 'En 12-18 meses',
    '0': 'Solo explorando'
}

export const TRAVEL_TIME_ALIASES: Record<string, string> = {
    '0-3': '0-3',
    '3-6': '3-6',
    '6-12': '6-12',
    '12-18': '12-18',
    '0': '0',
    '0 a 3': '0-3',
    '0-3 meses': '0-3',
    '0 a 3 meses': '0-3',
    '3 a 6': '3-6',
    '6 a 12': '6-12',
    '6-12 meses': '6-12',
    '12 a 18': '12-18',
    '12-18 meses': '12-18',
    'lo antes posible': '0-3',
    'asap': '0-3',
    'inmediato': '0-3',
    'en 3 a 6 meses': '3-6',
    'en 3-6 meses': '3-6',
    'en 6 a 12 meses': '6-12',
    'en 6-12 meses': '6-12',
    'en 12 a 18 meses': '12-18',
    'en 12-18 meses': '12-18',
    'solo explorando': '0',
    'exploring': '0',
    'no lo se': '0'
}

export type LeadImportKey =
    | 'name'
    | 'email'
    | 'phone'
    | 'travelTime'
    | 'statusId'
    | 'priorityId'
    | 'referralCode'
    | 'referralId'
    | 'assignedTo'

const HEADER_ALIASES: Record<string, LeadImportKey> = {
    name: 'name',
    nombre: 'name',
    full_name: 'name',
    email: 'email',
    correo: 'email',
    correo_electronico: 'email',
    phone: 'phone',
    telefono: 'phone',
    phone_number: 'phone',
    celular: 'phone',
    travel_time: 'travelTime',
    traveltime: 'travelTime',
    tiempo_de_viaje: 'travelTime',
    status_id: 'statusId',
    statusid: 'statusId',
    estado: 'statusId',
    priority_id: 'priorityId',
    priorityid: 'priorityId',
    prioridad: 'priorityId',
    referral_code: 'referralCode',
    referralcode: 'referralCode',
    codigo_de_referido: 'referralCode',
    referral_id: 'referralId',
    referralid: 'referralId',
    assigned_to: 'assignedTo',
    assignedto: 'assignedTo',
    asignado: 'assignedTo'
}

export const REQUIRED_COLUMNS: LeadImportKey[] = [
    'name',
    'email',
    'phone',
    'travelTime'
]

export const OPTIONAL_COLUMNS: LeadImportKey[] = [
    'statusId',
    'priorityId',
    'referralCode',
    'referralId',
    'assignedTo'
]

export function normalizeHeader(header: string): string {
    return header
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '')
}

export function mapColumnKey(header: string): LeadImportKey | null {
    const key = normalizeHeader(header)
    return HEADER_ALIASES[key] || null
}

export function normalizeTravelTime(value: string): string {
    const key = value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
    return TRAVEL_TIME_ALIASES[key] || ''
}

export interface RawImportRow {
    name?: string
    email?: string
    phone?: string
    travelTime?: string
    statusId?: string
    priorityId?: string
    referralCode?: string
    referralId?: string
    assignedTo?: string
    [key: string]: string | undefined
}

export interface NormalizedLeadRow {
    row: number
    name: string
    email: string
    phone: string
    travelTime: string
    statusId?: number
    priorityId?: number
    referralId?: number | null
    assignedTo?: string
}

export interface ImportReviewResult {
    index: number
    row: number
    valid: boolean
    errors: string[]
    warnings: string[]
    lead?: NormalizedLeadRow
}

export function toCsvCell(value: string): string {
    return value.includes(',') || value.includes('"') || value.includes('\n')
        ? `"${value.replace(/"/g, '""')}"`
        : value
}

export function buildTemplateCsv(): string {
    const header = [
        'name',
        'email',
        'phone',
        'travelTime',
        'statusId',
        'priorityId',
        'referralCode'
    ]
    const example = [
        'Juan Pérez',
        'juan@example.com',
        '+52 55 1234 5678',
        '0-3',
        '1',
        '1',
        ''
    ]
    const travelTimeValues =
        'Valid values for "travelTime": ' +
        TRAVEL_TIME_VALUES.map(
            (v) => `${v} (${TRAVEL_TIME_LABELS[v]})`
        ).join(', ')
    return (
        '\uFEFF' +
        '# ' +
        travelTimeValues +
        '\n' +
        [header.map(toCsvCell).join(','), example.map(toCsvCell).join(',')].join(
            '\n'
        ) +
        '\n'
    )
}