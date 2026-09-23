export const CURRENCIES = ['EUR', 'CRC', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const QUOTATION_STATUSES = [
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'canceled'
] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    expired: 'Vencida',
    canceled: 'Anulada'
}

export const EXTRA_PRICE_TYPES = ['fixed', 'variable'] as const
export type ExtraPriceType = (typeof EXTRA_PRICE_TYPES)[number]

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export const COMPANY_DEFAULT_NAME = 'S Travel Costa Rica'

export interface QuotationCompany {
    companyName: string
    logo: string | null
    phone: string | null
    whatsapp: string | null
    email: string | null
    website: string | null
    facebook: string | null
    instagram: string | null
    address: string | null
    terms: string | null
    currency: Currency
    advisorName: string | null
    advisorEmail: string | null
}

export interface QuotationExtraLine {
    key: string
    id: number | null
    name: string
    description: string
    price: number
    priceType: ExtraPriceType
}

export interface QuotationDiscountLine {
    key: string
    id: number | null
    name: string
    type: DiscountType
    value: number
    currency: Currency
    amount: number
    startsAt: string | Date | null
    endsAt: string | Date | null
}

export interface QuotationSchoolIncludeLine {
    id: number | null
    name: string
    description: string
}

export interface QuotationAccommodation {
    included: boolean
    id: number | null
    name: string
    type: string
    weeks: number
    pricePerWeek: number
    minWeeks: number | null
    maxWeeks: number | null
}

export interface QuotationDraft {
    version: 1
    client: {
        name: string
        phone: string
        email: string
        country: string
    }
    advisor: {
        id: string | null
        name: string
        email: string
    }
    currency: Currency
    issueDate: string
    validUntil: string
    program: {
        id: number | null
        name: string
        includes: string[]
    } | null
    course: {
        id: number | null
        schoolId: number | null
        schoolName: string
        name: string
        description: string
        scheduleName: string
        weeks: number
        hoursPerWeek: number
        price: number
    } | null
    schoolIncludes: QuotationSchoolIncludeLine[]
    accommodation: QuotationAccommodation
    extras: QuotationExtraLine[]
    discounts: QuotationDiscountLine[]
}

export interface PricingTotals {
    course: number
    accommodation: number
    extras: number
    subtotal: number
    discount: number
    total: number
}

export interface QuotationData extends QuotationDraft {
    company: QuotationCompany
    totals: PricingTotals
}

export interface QuotationSummary {
    id: number
    number: string
    customerId: number
    status: QuotationStatus
    currency: Currency
    issueDate: Date | string | null
    validUntil: Date | string | null
    advisorId: string | null
    advisorName: string | null
    advisorEmail: string | null
    clientName: string
    clientCountry: string | null
    programName: string | null
    schoolName: string | null
    courseName: string | null
    courseTotal: number
    discountTotal: number
    total: number
    subtotal: number
    createdAt: Date | string | null
    updatedAt: Date | string | null
    isOwner: boolean
    isAdmin: boolean
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    EUR: '€',
    CRC: '₡',
    USD: '$'
}

export function isCurrency(value: string | null | undefined): value is Currency {
    return CURRENCIES.includes(value as Currency)
}

function currencyFormatter(currency: Currency) {
    try {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency
        })
    } catch {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'EUR'
        })
    }
}

export function formatMoney(amount: number, currency: Currency): string {
    const value = amount || 0
    if (Number.isInteger(value)) {
        return formatMoneyCompact(amount, currency)
    }
    return currencyFormatter(currency).format(value)
}

export function formatMoneyCompact(amount: number, currency: Currency): string {
    const value = amount || 0
    const symbol = CURRENCY_SYMBOLS[currency] || '€'
    const fixed = value.toLocaleString('es-CR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })
    return `${symbol}${fixed}`
}

export function toDateInputValue(value: Date | string | null | undefined): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function parseDateInput(value: string | null | undefined): Date | null {
    if (!value) return null
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    return date
}

export function formatDateShort(value: Date | string | null | undefined): string {
    if (!value) return '—'
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    try {
        return date.toLocaleDateString('es-CR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    } catch {
        return toDateInputValue(date)
    }
}

export function formatDateLong(value: Date | string | null | undefined): string {
    if (!value) return '—'
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    try {
        return date.toLocaleDateString('es-CR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    } catch {
        return toDateInputValue(date)
    }
}

export function slugifyFilename(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function quotationPdfFilename(
    number: string,
    clientName: string
): string {
    return `ST-Cotizacion-${number}-${slugifyFilename(clientName || 'Cliente')}.pdf`
}

export function makeLineKey(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function validateDraftPure(
    draft: QuotationDraft
): string | null {
    if (!draft.client?.name?.trim()) {
        return 'El cliente es obligatorio'
    }
    if (!isCurrency(draft.currency)) {
        return 'La cotización debe tener una moneda'
    }

    const issueDate = parseDateInput(draft.issueDate)
    const validUntil = parseDateInput(draft.validUntil)

    if (!issueDate) {
        return 'La fecha de emisión es obligatoria y debe ser válida'
    }
    if (!validUntil) {
        return 'La fecha de vencimiento es obligatoria y debe ser válida'
    }
    if (validUntil.getTime() < issueDate.getTime()) {
        return 'La fecha de vencimiento no puede ser anterior a la fecha de emisión'
    }

    if (draft.course && draft.course.price < 0) {
        return 'El precio del curso no puede ser negativo'
    }

    if (draft.accommodation.included) {
        const weeks = draft.accommodation.weeks
        if (!weeks || weeks <= 0) {
            return 'La cantidad de semanas de alojamiento es inválida'
        }
        if (
            draft.accommodation.minWeeks != null &&
            weeks < draft.accommodation.minWeeks
        ) {
            return `El alojamiento requiere un mínimo de ${draft.accommodation.minWeeks} semanas`
        }
        if (
            draft.accommodation.maxWeeks != null &&
            weeks > draft.accommodation.maxWeeks
        ) {
            return `El alojamiento permite máximo ${draft.accommodation.maxWeeks} semanas`
        }
        if (draft.accommodation.pricePerWeek < 0) {
            return 'El precio del alojamiento no puede ser negativo'
        }
    }

    for (const extra of draft.extras || []) {
        if (!extra.name) return 'Los extras deben tener un nombre'
        if (typeof extra.price !== 'number' || extra.price < 0) {
            return `El extra "${extra.name}" tiene un precio inválido`
        }
    }

    for (const discount of draft.discounts || []) {
        if (!discount.name) {
            return 'Los descuentos deben tener un nombre'
        }
        if (typeof discount.value !== 'number' || discount.value <= 0) {
            return `El descuento "${discount.name}" tiene un valor inválido`
        }
        if (discount.type === 'percent' && discount.value > 100) {
            return `El descuento "${discount.name}" no puede superar el 100%`
        }
    }

    return null
}

/**
 * Beneficios que se muestran en la sección "Incluye": los del programa más
 * los del paquete de la escuela seleccionada (certificaciones, fees, etc.).
 */
export function quotationIncludes(
    draft: Pick<QuotationDraft, 'program' | 'schoolIncludes'>
): string[] {
    const programIncludes = draft.program?.includes ?? []
    const schoolIncludes = (draft.schoolIncludes ?? [])
        .map((item) => item.name.trim())
        .filter(Boolean)
    return [...programIncludes, ...schoolIncludes]
}

export function defaultDraft(
    client: {
        name: string
        phone?: string
        email?: string
        country?: string
    },
    advisor: { id?: string | null; name?: string | null; email?: string | null },
    currency: Currency,
    now = new Date()
): QuotationDraft {
    const issueDate = new Date(now)
    const validUntil = new Date(now)
    validUntil.setDate(validUntil.getDate() + 7)

    return {
        version: 1,
        client: {
            name: client.name || '',
            phone: client.phone || '',
            email: client.email || '',
            country: client.country || ''
        },
        advisor: {
            id: advisor.id ?? null,
            name: advisor.name || '',
            email: advisor.email || ''
        },
        currency,
        issueDate: toDateInputValue(issueDate),
        validUntil: toDateInputValue(validUntil),
        program: null,
        course: null,
        schoolIncludes: [],
        accommodation: {
            included: false,
            id: null,
            name: '',
            type: '',
            weeks: 0,
            pricePerWeek: 0,
            minWeeks: null,
            maxWeeks: null
        },
        extras: [],
        discounts: []
    }
}

export function toDraft(data: QuotationData): QuotationDraft {
    return {
        version: 1,
        client: { ...data.client },
        advisor: { ...data.advisor },
        currency: data.currency,
        issueDate: data.issueDate,
        validUntil: data.validUntil,
        program: data.program
            ? { ...data.program, includes: [...data.program.includes] }
            : null,
        course: data.course ? { ...data.course } : null,
        schoolIncludes: data.schoolIncludes
            ? data.schoolIncludes.map((item) => ({ ...item }))
            : [],
        accommodation: {
            ...data.accommodation,
            name: data.accommodation.name || ''
        },
        extras: data.extras.map((extra) => ({ ...extra })),
        discounts: data.discounts.map((discount) => ({ ...discount }))
    }
}