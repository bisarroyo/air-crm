import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
    quotations,
    quotationItems,
    quotationSettings
} from '@/db/schema'
import {
    computeTotals,
    computeAccommodation
} from './pricing'
import { nextQuotationNumber, parseCurrency } from './numbering'
import {
    COMPANY_DEFAULT_NAME,
    parseDateInput,
    validateDraftPure,
    type Currency,
    type QuotationCompany,
    type QuotationData,
    type QuotationDraft,
    type QuotationStatus,
    type QuotationSummary
} from './shared'

export interface SaveQuotationInput {
    data: QuotationDraft
    status?: 'draft' | 'sent'
}

export type SessionUser = {
    id: string
    name?: string | null
    email?: string | null
    role?: string | null
}

export function companyToSnapshot(
    settings: {
        companyName: string | null
        logo: string | null
        phone: string | null
        whatsapp: string | null
        email: string | null
        website: string | null
        facebook: string | null
        instagram: string | null
        address: string | null
        terms: string | null
        currency: string | null
        advisorName?: string | null
        advisorEmail?: string | null
    }
): QuotationCompany {
    return {
        companyName: settings.companyName || COMPANY_DEFAULT_NAME,
        logo: settings.logo,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        email: settings.email,
        website: settings.website,
        facebook: settings.facebook,
        instagram: settings.instagram,
        address: settings.address,
        terms: settings.terms,
        currency: parseCurrency(settings.currency),
        advisorName: settings.advisorName ?? null,
        advisorEmail: settings.advisorEmail ?? null
    }
}

export async function getCompanySettings() {
    const [existing] = await db
        .select()
        .from(quotationSettings)
        .where(eq(quotationSettings.id, 1))
        .limit(1)

    if (existing) return existing

    await db.insert(quotationSettings).values({
        id: 1,
        companyName: COMPANY_DEFAULT_NAME,
        currency: 'EUR'
    })

    const [created] = await db
        .select()
        .from(quotationSettings)
        .where(eq(quotationSettings.id, 1))
        .limit(1)

    return created
}

export async function snapshotCompany() {
    return companyToSnapshot(await getCompanySettings())
}

export function validateDraft(draft: QuotationDraft): {
    error?: string
    totals?: ReturnType<typeof computeTotals>
} {
    const error = validateDraftPure(draft)
    if (error) return { error }
    return { totals: computeTotals(draft) }
}

function eurosToCents(amount: number): number {
    return Math.round((amount || 0) * 100)
}

async function buildData(
    draft: QuotationDraft
): Promise<{ data: QuotationData | null; error: string | null }> {
    const validationError = validateDraftPure(draft)
    if (validationError) {
        return { data: null, error: validationError }
    }
    const totals = computeTotals(draft)

    let company: QuotationCompany
    try {
        company = await snapshotCompany()
    } catch {
        company = {
            companyName: COMPANY_DEFAULT_NAME,
            logo: null,
            phone: null,
            whatsapp: null,
            email: null,
            website: null,
            facebook: null,
            instagram: null,
            address: null,
            terms: null,
            currency: parseCurrency(draft.currency),
            advisorName: null,
            advisorEmail: null
        }
    }

    return {
        data: {
            ...draft,
            company,
            totals
        },
        error: null
    }
}

function quotationColumns(
    data: QuotationData,
    status: QuotationStatus,
    session: SessionUser
): Omit<typeof quotations.$inferInsert, 'number' | 'customerId'> {
    return {
        status,
        currency: data.currency,
        issueDate: parseDateInput(data.issueDate),
        validUntil: parseDateInput(data.validUntil),
        advisorId: session.id,
        advisorName: data.advisor.name || session.name || null,
        advisorEmail: data.advisor.email || session.email || null,
        clientName: data.client.name,
        clientPhone: data.client.phone || null,
        clientEmail: data.client.email || null,
        clientCountry: data.client.country || null,
        programId: data.program?.id ?? null,
        programName: data.program?.name ?? null,
        courseId: data.course?.id ?? null,
        schoolId: data.course?.schoolId ?? null,
        schoolName: data.course?.schoolName ?? null,
        courseName: data.course?.name ?? null,
        scheduleName: data.course?.scheduleName ?? null,
        weeks: data.course?.weeks ?? null,
        hoursPerWeek: data.course?.hoursPerWeek ?? null,
        coursePriceCents: eurosToCents(data.course?.price ?? 0),
        accommodationIncluded: data.accommodation.included,
        accommodationId: data.accommodation.id ?? null,
        accommodationName: data.accommodation.included
            ? data.accommodation.name
            : null,
        accommodationType: data.accommodation.included
            ? data.accommodation.type
            : null,
        accommodationWeeks: data.accommodation.included
            ? data.accommodation.weeks
            : null,
        accommodationPricePerWeekCents: eurosToCents(data.accommodation.included ? data.accommodation.pricePerWeek : 0),
        courseTotalCents: eurosToCents(data.totals.course),
        accommodationTotalCents: eurosToCents(data.totals.accommodation),
        extrasTotalCents: eurosToCents(data.totals.extras),
        subtotalCents: eurosToCents(data.totals.subtotal),
        discountTotalCents: eurosToCents(data.totals.discount),
        totalCents: eurosToCents(data.totals.total)
    }
}

function itemsFromData(
    quotationId: number,
    data: QuotationData
): Array<typeof quotationItems.$inferInsert> {
    const items: Array<typeof quotationItems.$inferInsert> = []
    let order = 0

    if (data.course) {
        items.push({
            quotationId,
            kind: 'course',
            label: data.course.name,
            description: data.course.schoolName || null,
            quantity: data.course.weeks,
            unitPriceCents:
                data.course.weeks > 0
                    ? eurosToCents(Math.round(data.course.price / data.course.weeks * 100) / 100)
                    : 0,
            totalCents: eurosToCents(data.course.price),
            currency: data.currency,
            sortOrder: order++,
            sourceType: 'course',
            sourceId: data.course.id
        })
    }

    if (data.accommodation.included) {
        items.push({
            quotationId,
            kind: 'accommodation',
            label: data.accommodation.name,
            description: data.accommodation.type || null,
            quantity: data.accommodation.weeks,
            unitPriceCents: eurosToCents(data.accommodation.pricePerWeek),
            totalCents: eurosToCents(computeAccommodation(data)),
            currency: data.currency,
            sortOrder: order++,
            sourceType: 'accommodation',
            sourceId: data.accommodation.id
        })
    }

    for (const extra of data.extras) {
        items.push({
            quotationId,
            kind: 'extra',
            label: extra.name,
            description: extra.description || null,
            quantity: 1,
            unitPriceCents: eurosToCents(extra.price),
            totalCents: eurosToCents(extra.price),
            currency: data.currency,
            sortOrder: order++,
            sourceType: 'extra',
            sourceId: extra.id
        })
    }

    for (const discount of data.discounts) {
        items.push({
            quotationId,
            kind: 'discount',
            label: discount.name,
            description:
                discount.type === 'percent'
                    ? `${discount.value}%`
                    : null,
            quantity: null,
            unitPriceCents: -eurosToCents(discount.amount),
            totalCents: -eurosToCents(discount.amount),
            currency: data.currency,
            sortOrder: order++,
            sourceType: 'discount',
            sourceId: discount.id
        })
    }

    return items
}

export async function createQuotation(
    customerId: number,
    input: SaveQuotationInput,
    session: SessionUser
): Promise<{ error?: string; quotation?: typeof quotations.$inferSelect }> {
    const draft = input.data
    if (!draft) {
        return { error: 'Datos de la cotización no válidos' }
    }
    const built = await buildData(draft)
    if (!built.data) return { error: built.error || 'Datos no válidos' }

    const status: QuotationStatus =
        input.status === 'sent' ? 'sent' : 'draft'
    const number = await nextQuotationNumber()

    try {
        const [inserted] = await db
            .insert(quotations)
            .values({
                number,
                customerId,
                data: JSON.stringify(built.data),
                ...quotationColumns(built.data, status, session)
            })
            .returning()

        const items = itemsFromData(inserted.id, built.data)
        if (items.length > 0) {
            await db.insert(quotationItems).values(items)
        }

        return { quotation: inserted }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message.includes('UNIQUE') ? 'Número duplicado' : message }
    }
}

export async function updateQuotation(
    quotationId: number,
    input: SaveQuotationInput,
    session: SessionUser
): Promise<{ error?: string; quotation?: typeof quotations.$inferSelect }> {
    const draft = input.data
    if (!draft) {
        return { error: 'Datos de la cotización no válidos' }
    }
    const built = await buildData(draft)
    if (!built.data) return { error: built.error || 'Datos no válidos' }

    const status: QuotationStatus =
        input.status === 'sent' ? 'sent' : 'draft'

    try {
        const [updated] = await db
            .update(quotations)
            .set({
                data: JSON.stringify(built.data),
                ...quotationColumns(built.data, status, session)
            })
            .where(eq(quotations.id, quotationId))
            .returning()

        if (!updated) return { error: 'Cotización no encontrada' }

        await db
            .delete(quotationItems)
            .where(eq(quotationItems.quotationId, quotationId))

        const items = itemsFromData(quotationId, built.data)
        if (items.length > 0) {
            await db.insert(quotationItems).values(items)
        }

        return { quotation: updated }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
    }
}

export async function duplicateQuotation(
    quotation: typeof quotations.$inferSelect
) {
    const number = await nextQuotationNumber()
    const data = quotation.data ? JSON.parse(quotation.data) : null
    const [created] = await db
        .insert(quotations)
        .values({
            number,
            customerId: quotation.customerId,
            status: 'draft',
            currency: quotation.currency,
            data: quotation.data,
            clientName: quotation.clientName,
            clientPhone: quotation.clientPhone,
            clientEmail: quotation.clientEmail,
            clientCountry: quotation.clientCountry,
            advisorId: quotation.advisorId,
            advisorName: quotation.advisorName,
            advisorEmail: quotation.advisorEmail
        })
        .returning()

    if (data && created) {
        const items = itemsFromData(created.id, data)
        if (items.length > 0) {
            await db.insert(quotationItems).values(items)
        }
        return { quotation: created }
    }
    return { quotation: created }
}

export function parseQuotationData(
    row: typeof quotations.$inferSelect
): QuotationData | null {
    if (!row.data) return null
    try {
        return JSON.parse(row.data) as QuotationData
    } catch {
        return null
    }
}

function centsToEuros(cents: number | null): number {
    return (cents || 0) / 100
}

export function toSummary(
    row: typeof quotations.$inferSelect,
    session: SessionUser
): QuotationSummary {
    const isAdmin = session.role === 'admin'
    const isOwner =
        row.advisorId === session.id ||
        (isAdmin ? true : false)
    return {
        id: row.id,
        number: row.number,
        customerId: row.customerId,
        status: row.status,
        currency: row.currency as Currency,
        issueDate: row.issueDate,
        validUntil: row.validUntil,
        advisorId: row.advisorId,
        advisorName: row.advisorName,
        advisorEmail: row.advisorEmail,
        clientName: row.clientName,
        clientCountry: row.clientCountry,
        programName: row.programName,
        schoolName: row.schoolName,
        courseName: row.courseName,
        courseTotal: centsToEuros(row.courseTotalCents),
        discountTotal: centsToEuros(row.discountTotalCents),
        total: centsToEuros(row.totalCents),
        subtotal: centsToEuros(row.subtotalCents),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isOwner,
        isAdmin
    }
}

export function canManageQuotation(
    row: { advisorId: string | null },
    session: SessionUser
): boolean {
    return session.role === 'admin' || row.advisorId === session.id
}