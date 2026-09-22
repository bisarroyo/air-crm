'use client'

import { ArrowLeft, ArrowRight, Loader2, Save, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
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
    SchoolRow
} from './types'

const STEPS = [
    'Cliente',
    'Programa',
    'Alojamiento',
    'Extras',
    'Descuentos',
    'Resumen',
    'Vista previa'
] as const

export interface WizardEditorProps {
    customerId: number
    mode: 'create' | 'edit'
    quotationId?: number
    initial: QuotationDraft
    company: QuotationCompany
    onClose: () => void
    onSaved: () => void
    programs?: ProgramRow[]
    schools?: SchoolRow[]
    schedules?: ScheduleRow[]
    courses?: CourseRow[]
    accommodations?: AccommodationRow[]
    extras?: ExtraRow[]
    discounts?: DiscountRow[]
}

export function WizardEditor({
    customerId,
    mode,
    quotationId,
    initial,
    company,
    onClose,
    onSaved,
    programs,
    schools,
    schedules,
    courses,
    accommodations,
    extras,
    discounts
}: WizardEditorProps) {
    const [step, setStep] = useState(0)
    const [draft, setDraft] = useState<QuotationDraft>(() =>
        JSON.parse(JSON.stringify(initial))
    )
    const [saving, setSaving] = useState(false)
    const modeNow = mode
    const [savedNumber, setSavedNumber] = useState<string | null>(null)

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
            return error('Debes seleccionar un curso en el paso Programa')
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
            const isEdit = modeNow === 'edit' && typeof quotationId === 'number'
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
            onSaved()
            if (!isEdit) {
                onClose()
                return
            }
            setSavedNumber(body?.number || null)
            setStep(6)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error')
        } finally {
            setSaving(false)
        }
    }

    const isLast = step === STEPS.length - 1
    const isFirst = step === 0

    return (
        <DialogContent className='max-h-[92vh] max-w-3xl overflow-y-auto'>
            <DialogHeader>
                <DialogTitle>
                    {modeNow === 'edit'
                        ? `Editar cotización${savedNumber ? ` · ${savedNumber}` : ''}`
                        : 'Nueva cotización'}
                </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className='flex flex-wrap items-center gap-1'>
                {STEPS.map((label, index) => (
                    <button
                        key={label}
                        type='button'
                        onClick={() => setStep(index)}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            index === step
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-input text-muted-foreground hover:text-foreground'
                        }`}>
                        <span>{index + 1}</span>
                        <span className='hidden sm:inline'>{label}</span>
                    </button>
                ))}
            </div>

            <div className='mt-4'>
                {step === 0 && <WizardStepClient draft={draft} setDraft={setDraft} />}
                {step === 1 && (
                    <WizardStepProgram
                        draft={draft}
                        setDraft={setDraft}
                        programs={programs}
                        schools={schools}
                        schedules={schedules}
                        courses={courses}
                    />
                )}
                {step === 2 && (
                    <WizardStepAccommodation
                        draft={draft}
                        setDraft={setDraft}
                        accommodations={accommodations}
                    />
                )}
                {step === 3 && (
                    <WizardStepExtras
                        draft={draft}
                        setDraft={setDraft}
                        extras={extras}
                        currency={draft.currency}
                    />
                )}
                {step === 4 && (
                    <WizardStepDiscounts
                        draft={draft}
                        setDraft={setDraft}
                        discounts={discounts}
                        currency={draft.currency}
                        subtotal={values.subtotal}
                    />
                )}
                {step === 5 && (
                    <WizardStepSummary draft={draft} totals={values} />
                )}
                {step === 6 && (
                    <QuotationPreview data={previewData} number={savedNumber ?? '—'} />
                )}
            </div>

            {/* Footer */}
            <div className='mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
                <Button
                    variant='ghost'
                    type='button'
                    onClick={onClose}>
                    Cancelar
                </Button>
                <div className='flex flex-wrap items-center gap-2'>
                    {!isLast ? (
                        <Button
                            type='button'
                            onClick={() =>
                                setStep((current) =>
                                    Math.min(current + 1, STEPS.length - 1)
                                )
                            }>
                            Siguiente
                            <ArrowRight className='ml-2 size-4' />
                        </Button>
                    ) : (
                        <>
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
                        </>
                    )}
                    {!isFirst && (
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() =>
                                setStep((current) => Math.max(current - 1, 0))
                            }>
                            <ArrowLeft className='mr-2 size-4' />
                            Anterior
                        </Button>
                    )}
                </div>
            </div>
        </DialogContent>
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