'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    Copy,
    Download,
    Loader2,
    Pencil,
    Send
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    QUOTATION_STATUS_LABELS,
    QUOTATION_STATUSES,
    type QuotationData,
    type QuotationStatus
} from '@/lib/cotizaciones/shared'
import { QuotationPreview } from './preview'

function StatusBadge({ status }: { status: QuotationStatus }) {
    const palette: Record<QuotationStatus, string> = {
        draft: 'bg-slate-100 text-slate-700',
        sent: 'bg-blue-100 text-blue-700',
        accepted: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700',
        expired: 'bg-amber-100 text-amber-700',
        canceled: 'bg-gray-100 text-gray-500'
    }
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette[status]}`}>
            {QUOTATION_STATUS_LABELS[status]}
        </span>
    )
}

async function patchStatus(
    customerId: number,
    quotationId: number,
    status: QuotationStatus
) {
    const res = await fetch(
        `/api/customers/${customerId}/quotations/${quotationId}`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        }
    )
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.error || 'No se pudo cambiar el estado')
    return body
}

function StatusChanger({
    customerId,
    quotationId,
    status,
    onChanged
}: {
    customerId: number
    quotationId: number
    status: QuotationStatus
    onChanged: (status: QuotationStatus) => void
}) {
    const mutation = useMutation<unknown, Error, QuotationStatus>({
        mutationFn: (next: QuotationStatus) =>
            patchStatus(customerId, quotationId, next),
        onSuccess: (_data, next) => onChanged(next),
        onError: (error: Error) => toast.error(error.message)
    })
    return (
        <Select
            value={status}
            onValueChange={(next) => {
                if (next && next !== status) mutation.mutate(next as QuotationStatus)
            }}
            items={QUOTATION_STATUSES.map((option) => ({
                value: option,
                label: QUOTATION_STATUS_LABELS[option]
            }))}>
            <SelectTrigger className='h-8 w-40'>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {QUOTATION_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                        {QUOTATION_STATUS_LABELS[option]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export function QuotationPreviewPage({
    customerId,
    quotationId,
    number,
    status,
    data,
    advisorName,
    canEdit
}: {
    customerId: number
    quotationId: number
    number: string
    status: QuotationStatus
    data: QuotationData
    advisorName?: string | null
    canEdit: boolean
}) {
    const queryClient = useQueryClient()
    const [currentStatus, setCurrentStatus] = useState(status)

    const duplicate = useMutation({
        mutationFn: async () => {
            const res = await fetch(
                `/api/customers/${customerId}/quotations/${quotationId}/duplicate`,
                { method: 'POST' }
            )
            const body = await res.json().catch(() => null)
            if (!res.ok) throw new Error(body?.error || 'No se pudo duplicar')
            return body
        },
        onSuccess: () => {
            toast.success('Cotización duplicada como borrador')
            queryClient.invalidateQueries({
                queryKey: ['quotations', customerId]
            })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const editable =
        canEdit && (currentStatus === 'draft' || currentStatus === 'sent')

    return (
        <div className='container mx-auto max-w-6xl space-y-4 p-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                    <Link
                        href={`/customers/${customerId}`}
                        className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm'
                        })}>
                        <ArrowLeft size={14} className='mr-2' />
                        Volver
                    </Link>
                    <h1 className='flex items-center gap-3 text-xl font-medium'>
                        Cotización {number}
                        <StatusBadge status={currentStatus} />
                    </h1>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    {editable && (
                        <>
                            <Link
                                href={`/customers/${customerId}/quotations/${quotationId}/edit`}
                                className={buttonVariants({
                                    variant: 'outline',
                                    size: 'sm'
                                })}>
                                <Pencil size={14} className='mr-2' />
                                Editar
                            </Link>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => duplicate.mutate()}
                                disabled={duplicate.isPending}>
                                {duplicate.isPending ? (
                                    <Loader2
                                        size={14}
                                        className='mr-2 animate-spin'
                                    />
                                ) : (
                                    <Copy size={14} className='mr-2' />
                                )}
                                Duplicar
                            </Button>
                            <StatusChanger
                                customerId={customerId}
                                quotationId={quotationId}
                                status={currentStatus}
                                onChanged={setCurrentStatus}
                            />
                        </>
                    )}
                    <a
                        href={`/api/customers/${customerId}/quotations/${quotationId}/pdf`}
                        target='_blank'
                        rel='noreferrer'
                        className={buttonVariants({
                            variant: 'outline',
                            size: 'sm'
                        })}>
                        <Download size={14} className='mr-2' />
                        PDF
                    </a>
                </div>
            </div>

            <div className='flex items-center justify-between gap-2 text-sm text-muted-foreground'>
                {advisorName ? (
                    <span>Escrita por {advisorName}</span>
                ) : (
                    <span />
                )}
                {currentStatus === 'sent' && (
                    <span className='flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800'>
                        <Send size={14} />
                        Cotización enviada al cliente
                    </span>
                )}
            </div>

            <QuotationPreview data={data} number={number} />
        </div>
    )
}