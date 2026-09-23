'use client'

import {
    quotationIncludes,
    formatMoney,
    type PricingTotals,
    type QuotationDraft
} from '@/lib/cotizaciones/shared'
import { computeDiscountLines } from '@/lib/cotizaciones/pricing'

export function WizardStepSummary({
    draft,
    totals
}: {
    draft: QuotationDraft
    totals: PricingTotals
}) {
    const currency = draft.currency
    const money = (amount: number) => formatMoney(amount, currency)
    const lines = computeDiscountLines(draft)

    return (
        <div className='space-y-5'>
            <div className='rounded-lg border'>
                <div className='flex items-center justify-between px-3 py-2 text-sm'>
                    <div className='min-w-0'>
                        <span className='font-semibold'>Programa</span>
                        {draft.course && (
                            <span className='ml-2 truncate text-muted-foreground'>
                                · {draft.course.name} · {draft.course.weeks} semanas
                            </span>
                        )}
                    </div>
                    <span className='font-semibold'>{money(totals.course)}</span>
                </div>
                <div className='flex items-center justify-between px-3 py-2 text-sm border-t'>
                    <div className='min-w-0'>
                        <span className='font-semibold'>Alojamiento</span>
                        {draft.accommodation.included && (
                            <span className='ml-2 truncate text-muted-foreground'>
                                · {draft.accommodation.name || 'Sin tipo'} · {draft.accommodation.weeks} semanas
                            </span>
                        )}
                    </div>
                    <span className='font-semibold'>{money(totals.accommodation)}</span>
                </div>
                <div className='flex items-center justify-between px-3 py-2 text-sm border-t'>
                    <div className='min-w-0'>
                        <span className='font-semibold'>Extras</span>
                        {draft.extras.length > 0 && (
                            <span className='ml-2 truncate text-muted-foreground'>
                                · {draft.extras.map((e) => e.name).join(' / ')}
                            </span>
                        )}
                    </div>
                    <span className='font-semibold'>{money(totals.extras)}</span>
                </div>
                <div className='flex items-center justify-between px-3 py-2 text-sm border-t'>
                    <span className='font-semibold'>Subtotal</span>
                    <span className='font-semibold'>{money(totals.subtotal)}</span>
                </div>
                {lines.length > 0 && (
                    <>
                        <div className='flex items-center justify-between px-3 py-2 text-sm border-t'>
                            <div className='min-w-0'>
                                <span className='font-semibold'>Descuentos ({lines.length})</span>
                                <span className='ml-2 truncate text-muted-foreground'>
                                    · {lines
                                        .map((line) =>
                                            line.type === 'percent'
                                                ? `${line.name} ${line.value}%`
                                                : line.name
                                        )
                                        .join(' / ')}
                                </span>
                            </div>
                            <span className='font-semibold'>{`- ${money(totals.discount)}`}</span>
                        </div>
                    </>
                )}
                <div className='flex items-center justify-between rounded-b-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground'>
                    <span>TOTAL</span>
                    <span>{money(totals.total)}</span>
                </div>
            </div>

            <div className='rounded-lg border bg-muted/30 p-3 text-sm'>
                {draft.discounts.length === 0 && (
                    <p className='text-muted-foreground'>
                        Sin descuentos. Ábrelos en el paso Descuentos.
                    </p>
                )}
                {draft.course?.name && (
                    <p>
                        <span className='text-muted-foreground'>Escuela: </span>
                        {draft.course.schoolName || '—'} ·{' '}
                        <span className='text-muted-foreground'>Horario: </span>
                        {draft.course.scheduleName || '—'}
                    </p>
                )}
                {draft.program && quotationIncludes(draft).length > 0 && (
                    <ul className='mt-1 list-inside list-disc'>
                        {quotationIncludes(draft).map((item) => (
                            <li key={item} className='text-muted-foreground'>
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}