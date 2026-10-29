'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Inbox,
    Loader2,
    Mail,
    MessageCircle,
    MessageSquareText,
    Pencil,
    Plane,
    Plus,
    Search,
    UserPlus,
    X
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { useSession } from '@/hooks/use-session'

interface StatusOption {
    id: number
    status: string
    color: string
    isActive: number
}

interface StatusLabel {
    id: number
    name: string
    color: string
}

interface TravelLeadRow {
    id: number
    name: string
    phone: string
    email: string
    metaInboxUrl: string | null
    statusId: number
    createdAt: string | null
    updatedAt: string | null
    statusName: string | null
    statusIsActive: number | null
    statusColor: string | null
}

interface TravelLeadsResponse {
    data: TravelLeadRow[]
    total: number
    page: number
    pageSize: number
}

const travelLeadSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').or(z.literal('')),
    metaInboxUrl: z.string().optional(),
    statusId: z.string().min(1, 'El estado es obligatorio')
})

type TravelLeadFormValues = z.infer<typeof travelLeadSchema>

function ColorDot({ color }: { color: string }) {
    return (
        <span
            className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
            style={{ backgroundColor: color || '#6b7280' }}
        />
    )
}

function firstNameCapitalized(name: string) {
    const firstName = name.trim().split(/\s+/)[0] ?? ''
    if (!firstName) return 'Sin nombre'
    return (
        firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    )
}

async function copyText(text: string, successMessage: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(successMessage)
    } catch {
        toast.error('No se pudo copiar al portapapeles')
    }
}

export default function TravelPage() {
    return (
        <Suspense
            fallback={
                <GlobeLoader fullScreen={false} className='min-h-[70vh]' />
            }>
            <TravelContent />
        </Suspense>
    )
}

function TravelContent() {
    const queryClient = useQueryClient()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { session, isPending: sessionLoading } = useSession()

    const [search, setSearch] = useState(searchParams.get('search') ?? '')
    const [filterStatusId, setFilterStatusId] = useState(
        searchParams.get('statusId') ?? ''
    )
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
    const [pageSize, setPageSize] = useState(
        Number(searchParams.get('pageSize')) || 25
    )

    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [bulkStatusId, setBulkStatusId] = useState('')

    const [modalOpen, setModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const form = useForm<TravelLeadFormValues>({
        resolver: zodResolver(travelLeadSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            metaInboxUrl: '',
            statusId: ''
        }
    })

    const queryKey = [
        'travel-leads',
        search,
        filterStatusId,
        page,
        pageSize
    ] as const

    const { data: leadsData, isLoading } = useQuery<TravelLeadsResponse>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (filterStatusId) params.set('statusId', filterStatusId)
            params.set('page', String(page))
            params.set('pageSize', String(pageSize))
            const res = await fetch(
                `/api/travel/leads?${params.toString()}`
            )
            if (!res.ok) throw new Error('No se pudo cargar')
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery({
        queryKey: ['travel-statuses'],
        queryFn: () => fetch('/api/travel/status').then((r) => r.json()),
        select: (data: StatusOption[]) =>
            data.map((s) => ({
                id: s.id,
                name: s.status,
                color: s.color || '#6b7280'
            }))
    }) as { data: StatusLabel[] | undefined }

    const statusItems = statuses.map((s) => ({
        value: String(s.id),
        label: s.name
    }))

    useEffect(() => {
        const url = new URLSearchParams()
        if (search) url.set('search', search)
        if (filterStatusId) url.set('statusId', filterStatusId)
        if (page > 1) url.set('page', String(page))
        if (pageSize !== 25) url.set('pageSize', String(pageSize))
        const qs = url.toString()
        router.replace(qs ? `/travel?${qs}` : '/travel', { scroll: false })
    }, [search, filterStatusId, page, pageSize, router])

    useEffect(() => {
        if (selectedIds.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBulkStatusId('')
        }
    }, [selectedIds])

    const leads = leadsData?.data ?? []
    const total = leadsData?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['travel-leads'] })

    const saveMutation = useMutation({
        mutationFn: async (data: TravelLeadFormValues) => {
            const isEdit = editingId !== null
            const url = isEdit
                ? `/api/travel/leads/${editingId}`
                : '/api/travel/leads'
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    phone: data.phone ?? '',
                    email: data.email ?? '',
                    metaInboxUrl: data.metaInboxUrl ?? '',
                    statusId: Number(data.statusId)
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo guardar')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success(
                editingId ? 'Lead actualizado' : 'Lead creado correctamente'
            )
            setModalOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const inlineUpdateMutation = useMutation({
        mutationFn: async ({
            id,
            statusId
        }: {
            id: number
            statusId: number
        }) => {
            const res = await fetch(`/api/travel/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statusId })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar')
            }
            return res.json()
        },
        onSuccess: () => invalidate(),
        onError: (error: Error) => toast.error(error.message)
    })

    const bulkMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/travel/leads/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: selectedIds,
                    statusId: Number(bulkStatusId)
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar en lote')
            }
            return res.json()
        },
        onSuccess: (res: { updated: number }) => {
            toast.success(`${res.updated} leads actualizados`)
            setSelectedIds([])
            setBulkStatusId('')
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openCreate = () => {
        setEditingId(null)
        form.reset({
            name: '',
            phone: '',
            email: '',
            metaInboxUrl: '',
            statusId: statuses[0] ? String(statuses[0].id) : ''
        })
        setModalOpen(true)
    }

    const openEdit = (lead: TravelLeadRow) => {
        setEditingId(lead.id)
        form.reset({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            metaInboxUrl: lead.metaInboxUrl ?? '',
            statusId: String(lead.statusId)
        })
        setModalOpen(true)
    }

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === leads.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(leads.map((lead) => lead.id))
        }
    }

    const copyWaSender = async (rows: TravelLeadRow[]) => {
        const lines = rows
            .filter((lead) => lead.phone.trim())
            .map(
                (lead) =>
                    `${firstNameCapitalized(lead.name)}, ${lead.phone.trim()}`
            )
        if (lines.length === 0) {
            toast.error('No hay teléfonos para copiar')
            return
        }
        await copyText(
            lines.join('\n'),
            `${lines.length} contactos copiados al portapapeles`
        )
    }

    const copyEmails = async (rows: TravelLeadRow[]) => {
        const emails = rows.map((lead) => lead.email.trim()).filter(Boolean)
        if (emails.length === 0) {
            toast.error('No hay correos para copiar')
            return
        }
        await copyText(
            emails.join(', '),
            `${emails.length} correos copiados al portapapeles`
        )
    }

    const exportCsv = (rows: TravelLeadRow[]) => {
        const headers = ['Nombre', 'Email', 'Teléfono', 'Enlace Meta', 'Estado']
        const csv =
            '\uFEFF' +
            [
                headers.join(','),
                ...rows.map((lead) =>
                    [
                        lead.name,
                        lead.email,
                        lead.phone,
                        lead.metaInboxUrl || '',
                        lead.statusName || ''
                    ]
                        .map((field) =>
                            field.includes(',') ? `"${field}"` : field
                        )
                        .join(',')
                )
            ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'travel-leads.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    if (sessionLoading) {
        return <GlobeLoader fullScreen={false} className='py-32' />
    }

    if (!session) {
        return (
            <div className='flex flex-col items-center justify-center py-32 text-center'>
                <UserPlus size={48} className='mb-4 text-muted-foreground' />
                <h2 className='mb-2 text-xl font-medium'>Travel</h2>
                <p className='mb-6 text-muted-foreground'>
                    Iniciá sesión para gestionar los leads de viaje
                </p>
                <Link href='/signin'>
                    <Button>Iniciar sesión</Button>
                </Link>
            </div>
        )
    }

    const selectedLeads = leads.filter((lead) =>
        selectedIds.includes(lead.id)
    )

    return (
        <div className='container mx-auto p-6'>
            <Card>
                <CardHeader>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <CardTitle className='flex items-center gap-2'>
                                <Plane size={18} className='text-primary' />
                                Travel
                            </CardTitle>
                            <p className='mt-0.5 text-sm text-muted-foreground'>
                                {total} lead{total !== 1 ? 's' : ''} de paquetes
                                de viaje
                            </p>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                title='Copiar nombre y teléfono de los leads visibles'
                                onClick={() => copyWaSender(leads)}>
                                <MessageSquareText size={16} /> Copiar remitente
                                WA
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                title='Copiar los correos de los leads visibles'
                                onClick={() => copyEmails(leads)}>
                                <Mail size={16} /> Copiar correos
                            </Button>
                            <Button onClick={openCreate} size='sm'>
                                <Plus /> Nuevo lead
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='mb-4 flex flex-wrap items-center gap-2'>
                        <div className='relative w-full min-w-[200px] sm:w-1/2'>
                            <Search
                                size={16}
                                className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                            />
                            <Input
                                type='text'
                                placeholder='Buscar por nombre, email o teléfono...'
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value)
                                    setPage(1)
                                }}
                                className='h-8 w-full pl-8 pr-8'
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <Select
                            value={filterStatusId}
                            items={[
                                { value: '', label: 'Todos los estados' },
                                ...statusItems
                            ]}
                            onValueChange={(val) => {
                                setFilterStatusId(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[180px]'>
                                <SelectValue placeholder='Todos los estados' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value=''>
                                        Todos los estados
                                    </SelectItem>
                                    {statuses.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={String(s.id)}
                                            className='border-l-[3px] pl-3'
                                            style={{
                                                color: s.color,
                                                borderLeftColor: s.color
                                            }}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className='mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2'>
                            <span className='text-sm font-medium'>
                                {selectedIds.length} seleccionado
                                {selectedIds.length !== 1 ? 's' : ''}
                            </span>
                            <span className='text-muted-foreground'>|</span>
                            <label className='text-sm text-muted-foreground'>
                                Estado:
                            </label>
                            <Select
                                value={bulkStatusId}
                                items={[
                                    { value: '', label: 'Sin cambio' },
                                    ...statusItems
                                ]}
                                onValueChange={(val) =>
                                    setBulkStatusId(val ?? '')
                                }>
                                <SelectTrigger
                                    size='sm'
                                    className='h-7 text-xs'>
                                    <SelectValue placeholder='Sin cambio' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            Sin cambio
                                        </SelectItem>
                                        {statuses.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={String(s.id)}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button
                                size='xs'
                                onClick={() => {
                                    if (!bulkStatusId) {
                                        toast.error(
                                            'Seleccioná un estado para aplicar'
                                        )
                                        return
                                    }
                                    bulkMutation.mutate()
                                }}
                                disabled={bulkMutation.isPending}>
                                {bulkMutation.isPending ? (
                                    <Loader2
                                        size={14}
                                        className='animate-spin'
                                    />
                                ) : (
                                    'Guardar'
                                )}
                            </Button>
                            <span className='text-muted-foreground'>|</span>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => copyWaSender(selectedLeads)}>
                                <MessageSquareText size={14} /> Copiar remitente
                                WA
                            </Button>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => copyEmails(selectedLeads)}>
                                <Mail size={14} /> Copiar correos
                            </Button>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => exportCsv(selectedLeads)}>
                                Exportar CSV
                            </Button>
                            <Button
                                size='xs'
                                variant='ghost'
                                className='text-muted-foreground'
                                onClick={() => {
                                    setSelectedIds([])
                                    setBulkStatusId('')
                                }}>
                                Limpiar
                            </Button>
                        </div>
                    )}

                    {isLoading ? (
                        <GlobeLoader
                            fullScreen={false}
                            className='py-16'
                            size={120}
                        />
                    ) : leads.length === 0 ? (
                        <div className='py-16 text-center'>
                            <p className='text-muted-foreground'>
                                {search || filterStatusId
                                    ? 'Ningún lead coincide con tus filtros'
                                    : 'Todavía no hay leads de viaje. ¡Creá el primero!'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className='overflow-x-auto'>
                                <table className='w-full text-sm'>
                                    <thead>
                                        <tr className='border-b text-left text-muted-foreground'>
                                            <th className='w-8 pb-2'>
                                                <Checkbox
                                                    checked={
                                                        selectedIds.length ===
                                                            leads.length &&
                                                        leads.length > 0
                                                    }
                                                    onCheckedChange={
                                                        toggleSelectAll
                                                    }
                                                />
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Nombre
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Email
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Teléfono
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Meta Inbox
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Estado
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Creado
                                            </th>
                                            <th className='pb-2 font-medium text-right'>
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.map((lead) => {
                                            const statusColor =
                                                lead.statusColor || '#6b7280'
                                            return (
                                                <tr
                                                    key={lead.id}
                                                    className={`border-b last:border-0 transition-colors hover:bg-muted/50 ${
                                                        selectedIds.includes(
                                                            lead.id
                                                        )
                                                            ? 'bg-primary/5'
                                                            : ''
                                                    }`}>
                                                    <td className='py-2.5'>
                                                        <Checkbox
                                                            checked={selectedIds.includes(
                                                                lead.id
                                                            )}
                                                            onCheckedChange={() =>
                                                                toggleSelect(
                                                                    lead.id
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td className='py-2.5 font-medium'>
                                                        <Link
                                                            href={`/travel/${lead.id}`}
                                                            className='hover:underline'>
                                                            {lead.name}
                                                        </Link>
                                                    </td>
                                                    <td className='py-2.5 text-muted-foreground'>
                                                        {lead.email ? (
                                                            <button
                                                                type='button'
                                                                title='Copiar email'
                                                                className='cursor-pointer text-left hover:underline'
                                                                onClick={() =>
                                                                    copyText(
                                                                        lead.email,
                                                                        'Email copiado al portapapeles'
                                                                    )
                                                                }>
                                                                {lead.email}
                                                            </button>
                                                        ) : (
                                                            <span className='text-xs'>
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        {lead.phone ? (
                                                            <button
                                                                type='button'
                                                                title='Copiar teléfono'
                                                                className='cursor-pointer hover:underline'
                                                                onClick={() =>
                                                                    copyText(
                                                                        lead.phone,
                                                                        'Teléfono copiado al portapapeles'
                                                                    )
                                                                }>
                                                                {lead.phone}
                                                            </button>
                                                        ) : (
                                                            <span className='text-xs text-muted-foreground'>
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        {lead.metaInboxUrl ? (
                                                            <a
                                                                href={
                                                                    lead.metaInboxUrl
                                                                }
                                                                target='_blank'
                                                                rel='noopener noreferrer'
                                                                title='Abrir Meta Inbox'
                                                                className='inline-flex items-center gap-1 text-primary hover:underline'>
                                                                <Inbox
                                                                    size={14}
                                                                />
                                                                Abrir
                                                            </a>
                                                        ) : (
                                                            <span className='text-xs text-muted-foreground'>
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <Select
                                                            value={String(
                                                                lead.statusId
                                                            )}
                                                            onValueChange={(
                                                                val:
                                                                    | string
                                                                    | null
                                                            ) =>
                                                                val &&
                                                                inlineUpdateMutation.mutate(
                                                                    {
                                                                        id: lead.id,
                                                                        statusId:
                                                                            Number(
                                                                                val
                                                                            )
                                                                    }
                                                                )
                                                            }>
                                                            <SelectTrigger className='h-7 max-w-[150px] gap-1 text-xs'>
                                                                <ColorDot
                                                                    color={
                                                                        statusColor
                                                                    }
                                                                />
                                                                <SelectValue>
                                                                    {lead.statusName ||
                                                                        String(
                                                                            lead.statusId
                                                                        )}
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectGroup>
                                                                    {statuses.map(
                                                                        (s) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    s.id
                                                                                }
                                                                                value={String(
                                                                                    s.id
                                                                                )}>
                                                                                <ColorDot
                                                                                    color={
                                                                                        s.color
                                                                                    }
                                                                                />
                                                                                {
                                                                                    s.name
                                                                                }
                                                                            </SelectItem>
                                                                        )
                                                                    )}
                                                                </SelectGroup>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className='py-2.5 text-xs text-muted-foreground'>
                                                        {lead.createdAt
                                                            ? new Date(
                                                                  lead.createdAt
                                                              ).toLocaleDateString(
                                                                  'es',
                                                                  {
                                                                      dateStyle:
                                                                          'short'
                                                                  }
                                                              )
                                                            : '—'}
                                                    </td>
                                                    <td className='py-2.5 text-right'>
                                                        <div className='flex items-center justify-end gap-1'>
                                                            {lead.phone && (
                                                                <a
                                                                    href={`https://web.whatsapp.com/send/?phone=${lead.phone.replace(/\D/g, '')}&text&type=phone_number&app_absent=0`}
                                                                    target='_blank'
                                                                    rel='noopener noreferrer'>
                                                                    <Button
                                                                        size='icon-sm'
                                                                        variant='ghost'
                                                                        className='text-green-600 hover:text-green-700'
                                                                        title='Abrir WhatsApp'>
                                                                        <MessageCircle
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    </Button>
                                                                </a>
                                                            )}
                                                            <Link
                                                                href={`/travel/${lead.id}`}>
                                                                <Button
                                                                    size='icon-sm'
                                                                    variant='ghost'
                                                                    title='Ver información'>
                                                                    <ExternalLink
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                size='icon-sm'
                                                                variant='ghost'
                                                                title='Editar'
                                                                onClick={() =>
                                                                    openEdit(
                                                                        lead
                                                                    )
                                                                }>
                                                                <Pencil
                                                                    size={14}
                                                                />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
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
                                                {[10, 25, 50, 100].map((n) => (
                                                    <SelectItem
                                                        key={n}
                                                        value={String(n)}>
                                                        {n}
                                                    </SelectItem>
                                                ))}
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

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Editar' : 'Nuevo'} lead de viaje
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? 'Actualizá los datos del lead.'
                                : 'Ingresá los datos del nuevo lead de paquetes de viaje.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={form.handleSubmit((data) =>
                            saveMutation.mutate(data)
                        )}
                        className='grid gap-4'>
                        <FieldGroup>
                            <Controller
                                name='name'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='travel-name'>
                                            Nombre
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='travel-name'
                                            placeholder='Nombre completo'
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name='phone'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='travel-phone'>
                                            Teléfono
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='travel-phone'
                                            type='tel'
                                            placeholder='+506 8888 8888'
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name='email'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='travel-email'>
                                            Correo electrónico
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='travel-email'
                                            type='email'
                                            placeholder='lead@example.com'
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name='metaInboxUrl'
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='travel-meta'>
                                            Enlace a Meta Inbox
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='travel-meta'
                                            inputMode='url'
                                            placeholder='https://business.facebook.com/...'
                                        />
                                    </Field>
                                )}
                            />
                            <Controller
                                name='statusId'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='travel-status'>
                                            Estado
                                        </FieldLabel>
                                        <Select
                                            value={field.value}
                                            items={statusItems}
                                            onValueChange={field.onChange}>
                                            <SelectTrigger
                                                id='travel-status'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }>
                                                <SelectValue placeholder='Seleccionar...' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {statuses.map((s) => (
                                                        <SelectItem
                                                            key={s.id}
                                                            value={String(
                                                                s.id
                                                            )}>
                                                            <ColorDot
                                                                color={s.color}
                                                            />
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <div className='flex justify-end gap-2 pt-2'>
                            <Button
                                type='button'
                                variant='ghost'
                                onClick={() => setModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type='submit'
                                disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? (
                                    <Loader2
                                        size={16}
                                        className='animate-spin'
                                    />
                                ) : editingId ? (
                                    'Actualizar lead'
                                ) : (
                                    'Crear lead'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
