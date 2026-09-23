'use client'

import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    defaultDraft,
    toDateInputValue,
    type QuotationCompany,
    type QuotationData,
    type QuotationDraft,
    type QuotationStatus
} from '@/lib/cotizaciones/shared'
import { computeTotals } from '@/lib/cotizaciones/pricing'
import { WizardStepAccommodation } from './wizard-step-accommodation'
import { WizardStepClient } from './wizard-step-client'
import { WizardStepExtras } from './wizard-step-extras'
import { WizardStepDiscounts } from './wizard-step-discounts'
import { WizardStepProgram } from './wizard-step-program'
import { WizardStepSummary } from './wizard-step-summary'
import { QuotationPreview } from './preview'
import type {
    AccommodationRow,
    CourseRow,
    DiscountRow,
    ExtraRow,
    ProgramRow,
    ScheduleRow,
    SchoolIncludeRow,
    SchoolRow
} from './types'

async function getJson(url: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error cargando ${url}`)
    return res.json()
}

interface WizardPageProps {
    customerId: number
    customer: {
        name: string
        phone: string
        email: string
        country?: string | null
    }
    mode: 'create' | 'edit'
    quotationId?: number
    initialDraft?: QuotationDraft
}

export function WizardPage({
    customerId,
    customer,
    mode,
    quotationId,
    initialDraft
}: WizardPageProps) {
    const router = useRouter()
    const [draft, setDraft] = useState<QuotationDraft>(() => {
        if (initialDraft) return initialDraft
        const base = defaultDraft(
            {
                name: customer.name || '',
                phone: customer.phone || '',
                email: customer.email || '',
                country: customer.country || ''
            },
            { id: null, name: '', email: '' },
            'EUR'
        )
        return base
    })
    const [saving, setSaving] = useState(false)
    const [savedNumber, setSavedNumber] = useState<string | null>(null)

    const settingsQuery = useQuery<QuotationCompany>({
        queryKey: ['quotation-settings'],
        queryFn: () => getJson('/api/admin/quotation-settings'),
    })

    const programsQuery = useQuery<ProgramRow[]>({
        queryKey: ['admin-programs'],
        queryFn: () => getJson('/api/admin/programs'),
    })
    const schoolsQuery = useQuery<SchoolRow[]>({
        queryKey: ['admin-schools'],
        queryFn: () => getJson('/api/admin/schools'),
    })
    const schoolIncludesQuery = useQuery<SchoolIncludeRow[]>({
        queryKey: ['admin-school-includes'],
        queryFn: () => getJson('/api/admin/school-includes'),
    })
    const schedulesQuery = useQuery<ScheduleRow[]>({
        queryKey: ['admin-schedules'],
        queryFn: () => getJson('/api/admin/schedules'),
    })
    const coursesQuery = useQuery<CourseRow[]>({
        queryKey: ['admin-courses'],
        queryFn: () => getJson('/api/admin/courses'),
    })
    const accommodationsQuery = useQuery<AccommodationRow[]>({
        queryKey: ['admin-accommodations'],
        queryFn: () => getJson('/api/admin/accommodations'),
    })
    const extrasQuery = useQuery<ExtraRow[]>({
        queryKey: ['admin-extras'],
        queryFn: () => getJson('/api/admin/extras'),
    })
    const discountsQuery = useQuery<DiscountRow[]>({
        queryKey: ['admin-discounts'],
        queryFn: () => getJson('/api/admin/discounts'),
    })

    const detailQuery = useQuery({
        queryKey: ['quotation-detail', customerId, quotationId],
        queryFn: () =>
            getJson(
                `/api/customers/${customerId}/quotations/${quotationId}`
            ),
        enabled:
            mode !== 'create' &&
            typeof quotationId === 'number'
    })

    const company: QuotationCompany =
        settingsQuery.data || {
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

    const values = computeTotals(draft)
    const previewData: QuotationData = {
        ...draft,
        company,
        totals: values,
        advisor: {
            id: '',
            name: '',
            email: ''
        }
    }

    function canGenerate(): { ok: boolean; error?: string } {
        const error = (next: string) => ({ ok: false, error: next })
        if (!draft.course) {
            return error('Debes seleccionar un curso en la sección Programa')
        }
        return { ok: true }
    }

    async function save(status: QuotationStatus) {
        if (status === 'sent') {
            const check = canGenerate()
            if (!check.ok) {
                toast.error(check.error)
                return
            }
        } else {
            const error = validateClientDraft(draft)
            if (error) {
                toast.error(error)
                return
            }
        }

        setSaving(true)
        try {
            const isEdit = mode === 'edit' && typeof quotationId === 'number'
            const url = isEdit
                ? `/api/customers/${customerId}/quotations/${quotationId}`
                : `/api/customers/${customerId}/quotations`
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: draft, status })
            })
            const body = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(body?.error || 'No se pudo guardar la cotización')
            }
            toast.success(
                status === 'sent' ? 'Cotización generada' : 'Borrador guardado'
            )
            if (!isEdit) {
                router.push(`/customers/${customerId}`)
                return
            }
            setSavedNumber(body?.number || null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error')
        } finally {
            setSaving(false)
        }
    }

    function handleCancel() {
        router.push(`/customers/${customerId}`)
    }

    const isLoadingCatalogs =
        settingsQuery.isLoading ||
        programsQuery.isLoading ||
        schoolsQuery.isLoading ||
        schoolIncludesQuery.isLoading ||
        schedulesQuery.isLoading ||
        coursesQuery.isLoading ||
        accommodationsQuery.isLoading ||
        extrasQuery.isLoading ||
        discountsQuery.isLoading

    const isLoadingDetail = detailQuery.isLoading

    if (isLoadingCatalogs || (mode !== 'create' && isLoadingDetail)) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <Loader2 size={24} className='animate-spin text-muted-foreground' />
            </div>
        )
    }

    return (
        <div className='min-h-screen bg-background'>
            {/* Sticky Header */}
            <header className='sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
                <div className='container mx-auto px-4 py-3 flex items-center gap-4'>
                    <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleCancel}
                        aria-label='Volver al cliente'>
                        <ArrowLeft size={18} />
                    </Button>
                    <div className='flex-1'>
                        <h1 className='text-lg font-medium'>
                            {mode === 'edit'
                                ? `Editar cotización${savedNumber ? ` · ${savedNumber}` : ''}`
                                : 'Nueva cotización'}
                        </h1>
                        <p className='text-sm text-muted-foreground'>
                            Cliente: {customer.name}
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className='container mx-auto px-4 py-6 max-w-5xl'>
                <div className='space-y-6'>
                    {/* Section: Cliente */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>1</span>
                                Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepClient draft={draft} setDraft={setDraft} />
                        </CardContent>
                    </Card>

                    {/* Section: Programa */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>2</span>
                                Programa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepProgram
                                draft={draft}
                                setDraft={setDraft}
                                programs={programsQuery.data}
                                schools={schoolsQuery.data}
                                schedules={schedulesQuery.data}
                                courses={coursesQuery.data}
                                schoolIncludes={schoolIncludesQuery.data}
                            />
                        </CardContent>
                    </Card>

                    {/* Section: Alojamiento */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>3</span>
                                Alojamiento
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepAccommodation
                                draft={draft}
                                setDraft={setDraft}
                                accommodations={accommodationsQuery.data}
                            />
                        </CardContent>
                    </Card>

                    {/* Section: Extras */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>4</span>
                                Extras
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepExtras
                                draft={draft}
                                setDraft={setDraft}
                                extras={extrasQuery.data}
                                currency={draft.currency}
                            />
                        </CardContent>
                    </Card>

                    {/* Section: Descuentos */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>5</span>
                                Descuentos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepDiscounts
                                draft={draft}
                                setDraft={setDraft}
                                discounts={discountsQuery.data}
                                currency={draft.currency}
                                subtotal={values.subtotal}
                            />
                        </CardContent>
                    </Card>

                    {/* Section: Resumen */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>6</span>
                                Resumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <WizardStepSummary draft={draft} totals={values} />
                        </CardContent>
                    </Card>

                    {/* Section: Vista previa */}
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <span className='text-primary font-medium'>7</span>
                                Vista previa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <QuotationPreview data={previewData} number={savedNumber ?? '—'} />
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Sticky Footer */}
            <footer className='sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4'>
                <div className='container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4'>
                    <Button
                        variant='ghost'
                        type='button'
                        onClick={handleCancel}>
                        Cancelar
                    </Button>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => save('draft')}
                            disabled={saving}>
                            {saving ? (
                                <Loader2 className='mr-2 size-4 animate-spin' />
                            ) : (
                                <Save className='mr-2 size-4' />
                            )}
                            Guardar borrador
                        </Button>
                        <Button
                            type='button'
                            onClick={() => save('sent')}
                            disabled={saving}>
                            {saving ? (
                                <Loader2 className='mr-2 size-4 animate-spin' />
                            ) : (
                                <Send className='mr-2 size-4' />
                            )}
                            Generar cotización
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    )
}

function validateClientDraft(draft: QuotationDraft): string | null {
    if (!draft.client?.name?.trim()) {
        return 'El cliente es obligatorio'
    }
    if (!draft.issueDate || !draft.validUntil) {
        return 'Las fechas son obligatorias'
    }
    if (
        toDateInputValue(draft.validUntil) < toDateInputValue(draft.issueDate)
    ) {
        return 'La fecha de vencimiento no puede ser anterior a la emisión'
    }
    return null
}