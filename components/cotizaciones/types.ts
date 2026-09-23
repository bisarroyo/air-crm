import { CURRENCIES, type Currency } from '@/lib/cotizaciones/shared'

export interface CatalogOption {
    id: number
    name: string
}

export interface ProgramRow extends CatalogOption {
    description: string | null
    includes: string | null
    isActive: number
}

export interface SchoolRow extends CatalogOption {
    description: string | null
    isActive: number
}

export interface ScheduleRow extends CatalogOption {
    isActive: number
}

export interface SchoolIncludeRow extends CatalogOption {
    description: string | null
    schoolIds: number[]
    isActive: number
}

export interface CourseRow {
    id: number
    programId: number | null
    schoolId: number | null
    name: string
    description: string | null
    weeks: number
    scheduleId: number | null
    hoursPerWeek: number
    price: number
    currency: string
    isActive: number
}

export interface AccommodationRow {
    id: number
    name: string
    type: string
    description: string | null
    pricePerWeek: number
    currency: string
    minWeeks: number | null
    maxWeeks: number | null
    isActive: number
}

export interface ExtraRow {
    id: number
    name: string
    description: string | null
    price: number
    currency: string
    priceType: 'fixed' | 'variable'
    application: string | null
    isActive: number
}

export interface DiscountRow {
    id: number
    name: string
    type: 'percent' | 'fixed'
    value: number
    currency: string
    startsAt: string | Date | null
    endsAt: string | Date | null
    isActive: number
}

export const COMPANY_FALLBACK = {
    companyName: 'S Travel Costa Rica',
    logo: null,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    facebook: null,
    instagram: null,
    address: null,
    terms: null,
    currency: 'EUR',
    advisorName: null,
    advisorEmail: null
} as const

export function makeLineKey(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function parseIncludes(value: string | null): string[] {
    if (!value) return []
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
}

export function safeCurrency(value: string | null | undefined): Currency {
    return CURRENCIES.includes(value as Currency)
        ? (value as Currency)
        : 'EUR'
}

export function toActive<T extends { isActive: number }>(
    rows: T[] | undefined
): T[] {
    return (rows || []).filter((row) => row.isActive === 1)
}

export function toOptions(rows: Array<{ id: number; name: string }>) {
    return rows.map((row) => ({ id: row.id, name: row.name }))
}

export function formatDateValue(
    value: string | Date | null | undefined
): string {
    if (!value) return ''
    if (typeof value === 'string') return value.slice(0, 10)
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function discountIsActive(
    discount: DiscountRow,
    now = new Date()
): boolean {
    if (discount.isActive !== 1) return false
    const today = formatDateValue(now)
    if (discount.startsAt && formatDateValue(discount.startsAt) > today) {
        return false
    }
    if (discount.endsAt && formatDateValue(discount.endsAt) < today) {
        return false
    }
    return true
}