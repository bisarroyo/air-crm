'use client'

import type { Dispatch, SetStateAction } from 'react'

import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import {
    CURRENCIES,
    type QuotationDraft
} from '@/lib/cotizaciones/shared'
import { COUNTRY_OPTIONS } from '@/lib/countries'

export function WizardStepClient({
    draft,
    setDraft
}: {
    draft: QuotationDraft
    setDraft: Dispatch<SetStateAction<QuotationDraft>>
}) {
    function setClient(field: keyof typeof draft.client, value: string) {
        setDraft((prev) => ({
            ...prev,
            client: { ...prev.client, [field]: value }
        }))
    }

    return (
        <div className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-3'>
                <Field>
                    <FieldLabel>Cliente *</FieldLabel>
                    <Input
                        value={draft.client.name}
                        onChange={(event) =>
                            setClient('name', event.target.value)
                        }
                        placeholder='Nombre y apellido'
                    />
                </Field>
                <Field>
                    <FieldLabel>Teléfono</FieldLabel>
                    <Input
                        value={draft.client.phone}
                        onChange={(event) =>
                            setClient('phone', event.target.value)
                        }
                        placeholder='+506 ...'
                    />
                </Field>
                <Field>
                    <FieldLabel>Email</FieldLabel>
                    <Input
                        type='email'
                        value={draft.client.email}
                        onChange={(event) =>
                            setClient('email', event.target.value)
                        }
                        placeholder='cliente@correo.com'
                    />
                </Field>
                <Field className='sm:col-span-3'>
                    <FieldLabel>País</FieldLabel>
                    <Select
                        value={draft.client.country}
                        onValueChange={(value) =>
                            setClient('country', value ?? '')
                        }>
                        <SelectTrigger aria-label='País'>
                            <SelectValue placeholder='Selecciona un país' />
                        </SelectTrigger>
                        <SelectContent>
                            {COUNTRY_OPTIONS.map((country) => (
                                <SelectItem key={country} value={country}>
                                    {country}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
                <Field>
                    <FieldLabel>Moneda de la cotización</FieldLabel>
                    <Select
                        value={draft.currency}
                        onValueChange={(value) =>
                            setDraft((prev) => ({
                                ...prev,
                                currency: value as typeof prev.currency
                            }))
                        }>
                        <SelectTrigger aria-label='Moneda'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CURRENCIES.map((currency) => (
                                <SelectItem key={currency} value={currency}>
                                    {currency}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel>Fecha de emisión</FieldLabel>
                    <DatePicker
                        value={draft.issueDate}
                        onChange={(value) =>
                            setDraft((prev) => ({
                                ...prev,
                                issueDate: value
                            }))
                        }
                        placeholder="Fecha de emisión"
                    />
                </Field>
                <Field>
                    <FieldLabel>Válida hasta</FieldLabel>
                    <DatePicker
                        value={draft.validUntil}
                        onChange={(value) =>
                            setDraft((prev) => ({
                                ...prev,
                                validUntil: value
                            }))
                        }
                        placeholder="Válida hasta"
                    />
                </Field>
            </div>
        </div>
    )
}