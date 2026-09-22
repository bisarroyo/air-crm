import type {
    QuotationDraft,
    QuotationDiscountLine,
    PricingTotals
} from './shared'

export function roundEuros(value: number): number {
    return Math.round(value * 100) / 100
}

export function computeCourse(data: QuotationDraft): number {
    return data.course?.price ?? 0
}

export function computeAccommodation(data: QuotationDraft): number {
    if (!data.accommodation.included) return 0
    return roundEuros(
        (data.accommodation.weeks || 0) * (data.accommodation.pricePerWeek || 0)
    )
}

export function computeExtras(data: QuotationDraft): number {
    return data.extras.reduce((sum, extra) => sum + (extra.price || 0), 0)
}

export function computeSubtotal(data: QuotationDraft): number {
    return roundEuros(
        computeCourse(data) + computeAccommodation(data) + computeExtras(data)
    )
}

export function computeDiscountLines(
    data: QuotationDraft
): QuotationDiscountLine[] {
    if (data.discounts.length === 0) return []
    const subtotal = computeSubtotal(data)
    let applied = 0
    return data.discounts.map((discount) => {
        let amount = 0
        if (discount.type === 'percent') {
            amount = roundEuros((subtotal * discount.value) / 100)
        } else {
            amount = discount.value
        }
        amount = Math.min(Math.max(amount, 0), Math.max(subtotal - applied, 0))
        applied += amount
        return { ...discount, amount: amount }
    })
}

export function computeDiscount(data: QuotationDraft): number {
    return computeDiscountLines(data).reduce(
        (sum, line) => sum + line.amount,
        0
    )
}

export function computeTotals(data: QuotationDraft): PricingTotals {
    const course = computeCourse(data)
    const accommodation = computeAccommodation(data)
    const extras = computeExtras(data)
    const subtotal = computeSubtotal(data)
    const discount = Math.min(computeDiscount(data), subtotal)
    const total = roundEuros(subtotal - discount)
    return {
        course,
        accommodation,
        extras,
        subtotal,
        discount,
        total
    }
}