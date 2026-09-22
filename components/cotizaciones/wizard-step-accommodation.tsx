'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { formatMoney, type QuotationDraft } from '@/lib/cotizaciones/shared'
import {
    toActive,
    toOptions,
    type AccommodationRow
} from './types'

export function WizardStepAccommodation({
    draft,
    setDraft,
    accommodations
}: {
    draft: QuotationDraft
    setDraft: Dispatch<SetStateAction<QuotationDraft>>
    accommodations?: AccommodationRow[]
}) {
    const active = toActive(accommodations)
    const [selectedId, setSelectedId] = useState<number | null>(
        draft.accommodation.id
    )

    const acc = draft.accommodation

    function selectAccommodation(value: string | null) {
        const id = value ? Number(value) : null
        setSelectedId(id)
        const row = active.find((item) => item.id === id) || null
        setDraft((prev) => ({
            ...prev,
            accommodation: {
                included: true,
                id: id,
                name: row?.name ?? '',
                type: row?.type ?? '',
                weeks: prev.accommodation.weeks || 2,
                pricePerWeek: row?.pricePerWeek ?? 0,
                minWeeks: row?.minWeeks ?? null,
                maxWeeks: row?.maxWeeks ?? null
            }
        }))
    }

    return (
        <div className='space-y-4'>
            <label className='flex items-center gap-2 text-sm font-medium'>
                <Checkbox
                    checked={acc.included}
                    onCheckedChange={(checked) =>
                        setDraft((prev) => ({
                            ...prev,
                            accommodation: {
                                ...prev.accommodation,
                                included: !!checked
                            }
                        }))
                    }
                />
                Alojamiento incluido
            </label>

            {acc.included && (
                <>
                    <div className='grid gap-4 sm:grid-cols-3'>
                        <Field className='sm:col-span-3'>
                            <FieldLabel>Tipo de alojamiento</FieldLabel>
                            <Select
                                value={selectedId ? String(selectedId) : ''}
                                onValueChange={selectAccommodation}
                                items={active.map((item) => ({
                                    value: String(item.id),
                                    label: item.name
                                }))}>
                                <SelectTrigger aria-label='Alojamiento'>
                                    <SelectValue placeholder='Selecciona un alojamiento' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {toOptions(active).map((option) => (
                                            <SelectItem
                                                key={option.id}
                                                value={String(option.id)}>
                                                {option.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel>Semanas</FieldLabel>
                            <Input
                                type='number'
                                min={1}
                                value={acc.weeks || ''}
                                onChange={(event) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        accommodation: {
                                            ...prev.accommodation,
                                            weeks: Math.max(
                                                0,
                                                Number(event.target.value) || 0
                                            )
                                        }
                                    }))
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel>
                                Precio semanal (en {draft.currency})
                            </FieldLabel>
                            <Input
                                type='number'
                                min={0}
                                step={0.01}
                                value={acc.pricePerWeek || ''}
                                onChange={(event) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        accommodation: {
                                            ...prev.accommodation,
                                            pricePerWeek:
                                                Math.max(
                                                    0,
                                                    Number(event.target.value) ||
                                                        0
                                                )
                                        }
                                    }))
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Total alojamiento</FieldLabel>
                            <div className='flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm font-medium'>
                                {formatMoney(
                                    (acc.pricePerWeek || 0) *
                                        (acc.weeks || 0),
                                    draft.currency
                                )}
                            </div>
                        </Field>
                    </div>
                    {(acc.minWeeks != null || acc.maxWeeks != null) && (
                        <p className='text-xs text-muted-foreground'>
                            {[
                                acc.minWeeks != null &&
                                    `Mínimo ${acc.minWeeks} semanas`,
                                acc.maxWeeks != null &&
                                    `Máximo ${acc.maxWeeks} semanas`
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}