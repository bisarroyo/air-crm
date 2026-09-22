'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import type { QuotationCompany } from '@/lib/cotizaciones/shared'

const EMPTY: QuotationCompany = {
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
}

const TEXT_FIELDS: Array<{ key: keyof QuotationCompany; label: string; placeholder?: string }> = [
    { key: 'companyName', label: 'Nombre de la empresa' },
    { key: 'phone', label: 'Teléfono', placeholder: '+506 8000 0000' },
    { key: 'whatsapp', label: 'WhatsApp', placeholder: '+506 8000 0000' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Sitio web' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'address', label: 'Dirección' },
    { key: 'advisorName', label: 'Nombre del asesor' },
    { key: 'advisorEmail', label: 'Email del asesor' }
]

export function CompanySettingsManager() {
    const queryClient = useQueryClient()
    const { data = EMPTY, isLoading } = useQuery<QuotationCompany>({
        queryKey: ['quotation-settings'],
        queryFn: async () => {
            const res = await fetch('/api/admin/quotation-settings')
            if (!res.ok) throw new Error('Error cargando configuración')
            return res.json()
        }
    })
    const [form, setForm] = useState<QuotationCompany | null>(null)

    const value: QuotationCompany =
        form ?? { ...data, companyName: data.companyName || EMPTY.companyName }

    function set(key: keyof QuotationCompany, v: string | null) {
        setForm((prev) => ({ ...(prev ?? data), [key]: v }))
    }

    const saveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/quotation-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...value, currency: value.currency })
            })
            const result = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(result?.error || 'No se pudo guardar')
            }
            return result
        },
        onSuccess: () => {
            toast.success('Configuración guardada')
            setForm(null)
            queryClient.invalidateQueries({
                queryKey: ['quotation-settings']
            })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    if (isLoading && !form) {
        return (
            <Card>
                <CardContent>
                    <GlobeLoader
                        fullScreen={false}
                        className='py-10'
                        size={100}
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de S Travel</CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
                <div className='grid gap-4 sm:grid-cols-2'>
                    <Field className='sm:col-span-2'>
                        <FieldLabel>
                            Logo de la empresa (aparece en los PDFs)
                        </FieldLabel>
                        <Input
                            type='file'
                            accept='image/*'
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (!file) return
                                const reader = new FileReader()
                                reader.onload = () =>
                                    set('logo', String(reader.result))
                                reader.readAsDataURL(file)
                            }}
                        />
                        {value.logo?.startsWith('data:') && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={value.logo}
                                alt='Logo'
                                className='mt-2 max-h-16 w-auto object-contain'
                            />
                        )}
                    </Field>
                    {TEXT_FIELDS.map((field) => (
                        <Field key={field.key}>
                            <FieldLabel>{field.label}</FieldLabel>
                            <Input
                                value={String(value[field.key] ?? '')}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                    set(field.key, event.target.value || null)
                                }
                            />
                        </Field>
                    ))}
                    <Field className='sm:col-span-2'>
                        <FieldLabel>Moneda por defecto</FieldLabel>
                        <Select
                            value={value.currency}
                            onValueChange={(next) => set('currency', next)}>
                            <SelectTrigger aria-label='Moneda por defecto'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='EUR'>EUR</SelectItem>
                                <SelectItem value='CRC'>CRC</SelectItem>
                                <SelectItem value='USD'>USD</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field className='sm:col-span-2'>
                        <FieldLabel>Condiciones / términos</FieldLabel>
                        <textarea
                            rows={4}
                            className='flex min-h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
                            value={String(value.terms ?? '')}
                            onChange={(event) =>
                                set('terms', event.target.value)
                            }
                            placeholder='Las condiciones generales que aparecen al final de cada cotización.'
                        />
                    </Field>
                </div>

                <div className='flex justify-end'>
                    <Button
                        type='button'
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? (
                            <Loader2 className='mr-2 size-4 animate-spin' />
                        ) : (
                            <Save className='mr-2 size-4' />
                        )}
                        Guardar configuración
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}