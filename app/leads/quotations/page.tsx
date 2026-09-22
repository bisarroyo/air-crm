'use client'

import { ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { GlobeLoader } from '@/components/ui/globe-loader'
import {
    formatDateShort,
    formatMoneyCompact,
    QUOTATION_STATUSES,
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

interface QuotationsResponse {
    data: QuotationSummary[]
    total: number
    page: number
    pageSize: number
    clients: { id: number; name: string }[]
}

export default function QuotationsPage() {
    return (
        <Suspense
            fallback={
                <GlobeLoader fullScreen={false} className='min-h-[70vh]' />
            }>
            <QuotationsContent />
        </Suspense>
    )
}

function QuotationsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [filterStatus, setFilterStatus] = useState(
        searchParams.get('status') ?? ''
    )
    const [filterCustomerId, setFilterCustomerId] = useState(
        searchParams.get('customerId') ?? ''
    )
    const [page, setPage] = useState(
        Number(searchParams.get('page')) || 1
    )
    const [pageSize, setPageSize] = useState(
        Number(searchParams.get('pageSize')) || 25
    )

    const { data, isLoading } = useQuery<QuotationsResponse>({
        queryKey: [
            'quotations',
            filterStatus,
            filterCustomerId,
            page,
            pageSize
        ] as const,
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filterStatus) params.set('status', filterStatus)
            if (filterCustomerId)
                params.set('customerId', filterCustomerId)
            params.set('page', String(page))
            params.set('pageSize', String(pageSize))

            const res = await fetch(`/api/quotations?${params.toString()}`)
            if (!res.ok) throw new Error('Error cargando cotizaciones')
            return res.json()
        }
    })

    useEffect(() => {
        const url = new URLSearchParams()
        if (filterStatus) url.set('status', filterStatus)
        if (filterCustomerId) url.set('customerId', filterCustomerId)
        if (page > 1) url.set('page', String(page))
        if (pageSize !== 25) url.set('pageSize', String(pageSize))
        const qs = url.toString()
        router.replace(qs ? `/leads/quotations?${qs}` : '/leads/quotations', {
            scroll: false
        })
    }, [filterStatus, filterCustomerId, page, pageSize, router])

    const rows = data?.data ?? []
    const total = data?.total ?? 0
    const clients = data?.clients ?? []
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className='container mx-auto p-6'>
            <Card>
                <CardHeader>
                    <div className='flex items-center justify-between'>
                        <div>
                            <CardTitle>Cotizaciones</CardTitle>
                            <p className='mt-0.5 text-sm text-muted-foreground'>
                                {total} cotización
                                {total !== 1 ? 'es' : ''}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='mb-4 flex flex-wrap items-center gap-2'>
                        <Select
                            value={
                                filterStatus
                                    ? QUOTATION_STATUS_LABELS[
                                          filterStatus as QuotationStatus
                                      ]
                                    : ''
                            }
                            onValueChange={(val) => {
                                setFilterStatus(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[170px]'>
                                <SelectValue placeholder='Todos los estados' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value=''>
                                        Todos los estados
                                    </SelectItem>
                                    {QUOTATION_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {QUOTATION_STATUS_LABELS[s]}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select
                            value={
                                clients.find(
                                    (c) => c.id === Number(filterCustomerId)
                                )?.name || ''
                            }
                            onValueChange={(val) => {
                                setFilterCustomerId(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[210px]'>
                                <SelectValue placeholder='Todos los clientes' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value=''>
                                        Todos los clientes
                                    </SelectItem>
                                    {clients.map((c) => (
                                        <SelectItem
                                            key={c.id}
                                            value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <GlobeLoader
                            fullScreen={false}
                            className='py-16'
                            size={120}
                        />
                    ) : rows.length === 0 ? (
                        <div className='py-16 text-center'>
                            <p className='text-muted-foreground'>
                                {filterStatus || filterCustomerId
                                    ? 'No hay cotizaciones que coincidan con los filtros'
                                    : 'Aún no hay cotizaciones'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className='overflow-x-auto'>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>N.º</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Servicio</TableHead>
                                            <TableHead>Emisión</TableHead>
                                            <TableHead>Válida</TableHead>
                                            <TableHead className='text-right'>
                                                Total
                                            </TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Asesor</TableHead>
                                            <TableHead className='text-right'>
                                                Acciones
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const service = [
                                                row.programName,
                                                row.courseName,
                                                row.schoolName
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className='font-medium'>
                                                        <Link
                                                            href={`/customers/${row.customerId}/quotations/${row.id}`}
                                                            className='hover:underline'>
                                                            {row.number}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Link
                                                            href={`/customers/${row.customerId}`}
                                                            className='hover:underline'>
                                                            {row.clientName}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        {service || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDateShort(
                                                            row.issueDate
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDateShort(
                                                            row.validUntil
                                                        )}
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
                                                                STATUS_BADGE[
                                                                    row.status
                                                                ]
                                                            )}>
                                                            {
                                                                QUOTATION_STATUS_LABELS[
                                                                    row.status
                                                                ]
                                                            }
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.advisorName ||
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className='flex items-center justify-end gap-1'>
                                                            <Link
                                                                className={buttonVariants(
                                                                    {
                                                                        variant:
                                                                            'ghost',
                                                                        size: 'icon-xs'
                                                                    }
                                                                )}
                                                                href={`/customers/${row.customerId}/quotations/${row.id}`}
                                                                title='Ver'>
                                                                <Eye size={14} />
                                                            </Link>
                                                            <a
                                                                className={buttonVariants(
                                                                    {
                                                                        variant:
                                                                            'ghost',
                                                                        size: 'icon-xs'
                                                                    }
                                                                )}
                                                                href={`/api/customers/${row.customerId}/quotations/${row.id}/pdf`}
                                                                target='_blank'
                                                                rel='noreferrer'
                                                                title='PDF'>
                                                                <Download
                                                                    size={14}
                                                                />
                                                            </a>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
                                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                    <span>Filas por página:</span>
                                    <Select
                                        value={String(pageSize)}
                                        onValueChange={(val) => {
                                            setPageSize(Number(val ?? 25))
                                            setPage(1)
                                        }}>
                                        <SelectTrigger
                                            size='sm'
                                            className='h-7 text-xs'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {[10, 25, 50, 100].map(
                                                    (n) => (
                                                        <SelectItem
                                                            key={n}
                                                            value={String(n)}>
                                                            {n}
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <span>
                                        {(page - 1) * pageSize + 1}–
                                        {Math.min(page * pageSize, total)} de{' '}
                                        {total}
                                    </span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <Button
                                        size='icon-sm'
                                        variant='outline'
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}>
                                        <ChevronLeft size={14} />
                                    </Button>
                                    {Array.from(
                                        {
                                            length: Math.min(totalPages, 5)
                                        },
                                        (_, i) => {
                                            const start = Math.max(
                                                1,
                                                Math.min(
                                                    page - 2,
                                                    totalPages - 4
                                                )
                                            )
                                            const p = start + i
                                            if (p > totalPages) return null
                                            return (
                                                <Button
                                                    key={p}
                                                    size='icon-sm'
                                                    variant={
                                                        p === page
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    onClick={() => setPage(p)}>
                                                    {p}
                                                </Button>
                                            )
                                        }
                                    )}
                                    <Button
                                        size='icon-sm'
                                        variant='outline'
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}>
                                        <ChevronRight size={14} />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}