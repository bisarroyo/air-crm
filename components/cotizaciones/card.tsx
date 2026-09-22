'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Copy,
    Download,
    Eye,
    Loader2,
    Pencil,
    Plus,
    Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    formatDateShort,
    formatMoneyCompact,
    QUOTATION_STATUS_LABELS,
    type QuotationStatus,
    type QuotationSummary
} from '@/lib/cotizaciones/shared'

const STATUS_BADGE: Record<QuotationStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    expired: 'bg-amber-100 text-amber-700',
    canceled: 'bg-gray-100 text-gray-500'
}

export function QuotationCard({ customerId }: { customerId: number }) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [busyId, setBusyId] = useState<number | null>(null)

    const { data: quotations = [], isLoading } = useQuery<QuotationSummary[]>({
        queryKey: ['quotations', customerId],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/quotations`)
            if (!res.ok) throw new Error('Error cargando cotizaciones')
            return res.json()
        }
    })

    function refresh() {
        queryClient.invalidateQueries({ queryKey: ['quotations', customerId] })
    }

    async function duplicate(row: QuotationSummary) {
        setBusyId(row.id)
        try {
            const res = await fetch(
                `/api/customers/${customerId}/quotations/${row.id}/duplicate`,
                { method: 'POST' }
            )
            const body = await res.json().catch(() => null)
            if (!res.ok) throw new Error(body?.error || 'No se pudo duplicar')
            toast.success('Cotización duplicada como borrador')
            refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error')
        } finally {
            setBusyId(null)
        }
    }

    async function remove(row: QuotationSummary) {
        setBusyId(row.id)
        try {
            const res = await fetch(
                `/api/customers/${customerId}/quotations/${row.id}`,
                { method: 'DELETE' }
            )
            const body = await res.json().catch(() => null)
            if (!res.ok) throw new Error(body?.error || 'No se pudo eliminar')
            toast.success('Cotización eliminada')
            refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className='w-full'>
            <Card>
                <CardHeader className='flex-row items-center justify-between'>
                    <CardTitle className='flex items-center gap-2'>
                        Cotizaciones
                        {isLoading && (
                            <Loader2
                                size={14}
                                className='animate-spin text-muted-foreground'
                            />
                        )}
                    </CardTitle>
                    <Button
                        size='sm'
                        onClick={() =>
                            router.push(`/customers/${customerId}/quotations/new`)
                        }>
                        <Plus className='mr-2 size-4' />
                        Nueva cotización
                    </Button>
                </CardHeader>
                <CardContent>
                    {quotations.length === 0 ? (
                        <p className='py-6 text-center text-sm text-muted-foreground'>
                            Aún no hay cotizaciones para este cliente.
                            Crea la primera para armar el paquete.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>N.º</TableHead>
                                    <TableHead>Servicio</TableHead>
                                    <TableHead>Emisión</TableHead>
                                    <TableHead>Válida</TableHead>
                                    <TableHead>País</TableHead>
                                    <TableHead className='text-right'>
                                        Total
                                    </TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className='text-right'>
                                        Acciones
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotations.map((row) => {
                                    const service = [
                                        row.courseName,
                                        row.schoolName,
                                        row.programName
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell className='font-medium'>
                                                <Link
                                                    href={`/customers/${customerId}/quotations/${row.id}`}
                                                    className='hover:underline'>
                                                    {row.number}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {service || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {formatDateShort(row.issueDate)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDateShort(row.validUntil)}
                                            </TableCell>
                                            <TableCell>
                                                {row.clientCountry || '—'}
                                            </TableCell>
                                            <TableCell className='text-right font-semibold'>
                                                {formatMoneyCompact(
                                                    row.total,
                                                    row.currency
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={cn(
                                                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                                        STATUS_BADGE[row.status]
                                                    )}>
                                                    {
                                                        QUOTATION_STATUS_LABELS[
                                                            row.status
                                                        ]
                                                    }
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className='flex items-center justify-end gap-1'>
                                                    <Link
                                                        className={buttonVariants({
                                                            variant: 'ghost',
                                                            size: 'icon-xs'
                                                        })}
                                                        href={`/customers/${customerId}/quotations/${row.id}`}
                                                        title='Ver'>
                                                        <Eye size={14} />
                                                    </Link>
                                                    <a
                                                        className={buttonVariants({
                                                            variant: 'ghost',
                                                            size: 'icon-xs'
                                                        })}
                                                        href={`/api/customers/${customerId}/quotations/${row.id}/pdf`}
                                                        target='_blank'
                                                        rel='noreferrer'
                                                        title='PDF'>
                                                        <Download size={14} />
                                                    </a>
                                                    {row.isOwner &&
                                                        (row.status === 'draft' ||
                                                            row.status ===
                                                                'sent') && (
                                                            <Button
                                                                variant='ghost'
                                                                size='icon-xs'
                                                                title='Editar'
                                                                onClick={() =>
                                                                    router.push(
                                                                        `/customers/${customerId}/quotations/${row.id}/edit`
                                                                    )
                                                                }>
                                                                <Pencil
                                                                    size={14}
                                                                />
                                                            </Button>
                                                        )}
                                                    {row.isOwner && (
                                                        <Button
                                                            variant='ghost'
                                                            size='icon-xs'
                                                            title='Duplicar'
                                                            disabled={
                                                                busyId === row.id
                                                            }
                                                            onClick={() =>
                                                                duplicate(row)
                                                            }>
                                                            <Copy size={14} />
                                                        </Button>
                                                    )}
                                                    {row.isOwner &&
                                                        row.status ===
                                                            'draft' && (
                                                            <Button
                                                                variant='ghost'
                                                                size='icon-xs'
                                                                className='text-destructive'
                                                                title='Eliminar'
                                                                disabled={
                                                                    busyId === row.id
                                                                }
                                                                onClick={() =>
                                                                    remove(row)
                                                                }>
                                                                <Trash2
                                                                    size={14}
                                                                />
                                                            </Button>
                                                        )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}