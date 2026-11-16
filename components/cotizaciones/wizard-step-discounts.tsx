'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    formatDateShort,
    formatMoney,
    type QuotationDraft
} from '@/lib/cotizaciones/shared'
import { computeDiscountLines, roundEuros } from '@/lib/cotizaciones/pricing'
import { makeLineKey, discountIsActive, type DiscountRow } from './types'

export function WizardStepDiscounts({
    draft,
    setDraft,
    discounts,
    currency,
    subtotal
}: {
    draft: QuotationDraft
    setDraft: Dispatch<SetStateAction<QuotationDraft>>
    discounts?: DiscountRow[]
    currency: QuotationDraft['currency']
    subtotal: number
}) {
    const activeDiscounts = discounts?.filter((d) => discountIsActive(d) && (d.type === 'percent' || d.currency === currency)) || []
    const appliedIds = new Set(
        draft.discounts
            .map((d) => d.id)
            .filter((id): id is number => id !== null)
    )

    function toggleDiscount(option: DiscountRow) {
        if (appliedIds.has(option.id)) {
            setDraft((prev) => ({
                ...prev,
                discounts: prev.discounts.filter((d) => d.id !== option.id)
            }))
            return
        }
        const type = option.type
        const value = option.value
        setDraft((prev) => ({
            ...prev,
            discounts: [
                ...prev.discounts,
                {
                    key: makeLineKey(),
                    id: option.id,
                    name: option.name,
                    type,
                    value,
                    currency,
                    amount: type === 'percent'
                        ? roundEuros((subtotal * value) / 100)
                        : value,
                    startsAt: option.startsAt ?? null,
                    endsAt: option.endsAt ?? null
                }
            ]
        }))
    }

    const computedDiscounts = computeDiscountLines(draft)

    function shownAmount(option: DiscountRow): number {
        if (option.type === 'percent') {
            return Math.min(subtotal, roundEuros((subtotal * option.value) / 100))
        }
        return Math.min(subtotal, option.value)
    }

    return (
        <div className='space-y-5'>
            <p className='text-sm text-muted-foreground'>
                Los descuentos se gestionan desde el catálogo y solo pueden
                aplicarse una vez cada uno.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        Descuentos del catálogo
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeDiscounts.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            No hay descuentos disponibles en el catálogo.
                        </p>
                    ) : (
                        <div className='space-y-2'>
                            {activeDiscounts.map((option) => {
                                const applied = appliedIds.has(option.id)
                                return (
                                    <div
                                        key={option.id}
                                        className='flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3'>
                                        <div>
                                            <div className='font-medium'>
                                                {option.name}
                                            </div>
                                            <div className='text-sm text-muted-foreground'>
                                                {option.type === 'percent'
                                                    ? `${option.value}%`
                                                    : formatMoney(
                                                          option.value,
                                                          currency
                                                      )}
                                                {option.endsAt
                                                    ? ` · Disponible hasta ${formatDateShort(option.endsAt)}`
                                                    : ''}
                                            </div>
                                        </div>
                                        <div className='flex shrink-0 items-center gap-3'>
                                            <span className='text-sm font-semibold text-destructive'>
                                                -{' '}
                                                {formatMoney(
                                                    shownAmount(option),
                                                    currency
                                                )}
                                            </span>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant={
                                                    applied
                                                        ? 'outline'
                                                        : 'default'
                                                }
                                                onClick={() =>
                                                    toggleDiscount(option)
                                                }>
                                                {applied ? (
                                                    <Minus
                                                        size={16}
                                                        className='mr-1'
                                                    />
                                                ) : (
                                                    <Plus
                                                        size={16}
                                                        className='mr-1'
                                                    />
                                                )}
                                                {applied ? 'Quitar' : 'Añadir'}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {computedDiscounts.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                    Sin descuentos aplicados.
                </p>
            )}

            <p className='text-sm font-semibold'>
                Total descuentos:{' '}
                <span>
                    {formatMoney(
                        computedDiscounts.reduce((sum, d) => sum + d.amount, 0),
                        currency
                    )}
                </span>
            </p>
        </div>
    )
}