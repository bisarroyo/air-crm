'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatMoney, type QuotationDraft } from '@/lib/cotizaciones/shared'
import { makeLineKey, type ExtraRow } from './types'

export function WizardStepExtras({
    draft,
    setDraft,
    extras,
    currency
}: {
    draft: QuotationDraft
    setDraft: Dispatch<SetStateAction<QuotationDraft>>
    extras?: ExtraRow[]
    currency: QuotationDraft['currency']
}) {
    const activeExtras = extras?.filter((e) => e.isActive === 1) || []

    function isAdded(id: number | null) {
        return id !== null && draft.extras.some((extra) => extra.id === id)
    }

    function toggleExtra(option: ExtraRow) {
        setDraft((prev) => {
            if (isAdded(option.id)) {
                return {
                    ...prev,
                    extras: prev.extras.filter((extra) => extra.id !== option.id)
                }
            }
            return {
                ...prev,
                extras: [
                    ...prev.extras,
                    {
                        key: makeLineKey(),
                        id: option.id,
                        name: option.name,
                        description: option.description ?? '',
                        price: option.price,
                        priceType: 'fixed'
                    }
                ]
            }
        })
    }

    return (
        <div className='space-y-5'>
            <p className='text-sm text-muted-foreground'>
                Los extras se gestionan desde el catálogo. Pulsa «Añadir» para
                incluirlos en la cotización.
            </p>

            {activeExtras.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                    No hay extras disponibles en el catálogo.
                </p>
            ) : (
                <div className='space-y-2'>
                    {activeExtras.map((option) => {
                        const added = isAdded(option.id)
                        return (
                            <div
                                key={option.id}
                                className='flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3'>
                                <div>
                                    <div className='font-medium'>
                                        {option.name}
                                    </div>
                                    {option.description ? (
                                        <div className='text-sm text-muted-foreground'>
                                            {option.description}
                                        </div>
                                    ) : null}
                                </div>
                                <div className='flex shrink-0 items-center gap-3'>
                                    <span className='font-semibold'>
                                        {formatMoney(option.price, currency)}
                                    </span>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant={added ? 'outline' : 'default'}
                                        onClick={() => toggleExtra(option)}>
                                        {added ? (
                                            <Minus size={16} className='mr-1' />
                                        ) : (
                                            <Plus size={16} className='mr-1' />
                                        )}
                                        {added ? 'Quitar' : 'Añadir'}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <p className='text-sm font-semibold'>
                Total extras:{' '}
                <span>
                    {formatMoney(
                        draft.extras.reduce((sum, e) => sum + e.price, 0),
                        currency
                    )}
                </span>
            </p>
        </div>
    )
}