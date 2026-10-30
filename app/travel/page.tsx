'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Check,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
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
import { Controller, useForm, useWatch } from 'react-hook-form'
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
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { TagMultiSelect, TagPill, type TagOption } from '@/components/tags'
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
    travelDateFrom: string | null
    travelDateTo: string | null
    tags: TagOption[]
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
    statusId: z.string().min(1, 'El estado es obligatorio'),
    travelDateFrom: z.string().optional(),
    travelDateTo: z.string().optional(),
    tagIds: z.array(z.number()).optional()
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
    const [filterTagIds, setFilterTagIds] = useState<number[]>(() => {
        const raw = searchParams.get('tagIds')
        if (!raw) return []
        return raw
            .split(',')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0)
    })
    const [filterDateFrom, setFilterDateFrom] = useState(
        searchParams.get('travelDateFrom') ?? ''
    )
    const [filterDateTo, setFilterDateTo] = useState(
        searchParams.get('travelDateTo') ?? ''
    )
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
    const [pageSize, setPageSize] = useState(
        Number(searchParams.get('pageSize')) || 25
    )

    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [bulkStatusId, setBulkStatusId] = useState('')
    const [bulkTagIds, setBulkTagIds] = useState<number[]>([])
    const [bulkTagAction, setBulkTagAction] = useState<
        'add' | 'remove' | 'replace'
    >('add')

    const [modalOpen, setModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const form = useForm<TravelLeadFormValues>({
        resolver: zodResolver(travelLeadSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            metaInboxUrl: '',
            statusId: '',
            travelDateFrom: '',
            travelDateTo: '',
            tagIds: []
        }
    })

    const travelDateFromValue = useWatch({
        control: form.control,
        name: 'travelDateFrom'
    })
    const travelDateToValue = useWatch({
        control: form.control,
        name: 'travelDateTo'
    })

    const queryKey = [
        'travel-leads',
        search,
        filterStatusId,
        filterTagIds,
        filterDateFrom,
        filterDateTo,
        page,
        pageSize
    ] as const

    const { data: leadsData, isLoading } = useQuery<TravelLeadsResponse>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (filterStatusId) params.set('statusId', filterStatusId)
            if (filterTagIds.length > 0) {
                params.set('tagIds', filterTagIds.join(','))
            }
            if (filterDateFrom) params.set('travelDateFrom', filterDateFrom)
            if (filterDateTo) params.set('travelDateTo', filterDateTo)
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

    const { data: travelTags = [] } = useQuery({
        queryKey: ['travel-tags'],
        queryFn: () => fetch('/api/travel/tags').then((r) => r.json()),
        select: (
            data: Array<{
                id: number
                tag: string
                color: string | null
                isActive: number
            }>
        ) =>
            data.map((t) => ({
                id: t.id,
                name: t.tag,
                color: t.color || '#6b7280',
                isActive: t.isActive
            }))
    }) as { data: TagOption[] | undefined }

    useEffect(() => {
        const url = new URLSearchParams()
        if (search) url.set('search', search)
        if (filterStatusId) url.set('statusId', filterStatusId)
        if (filterTagIds.length > 0) {
            url.set('tagIds', filterTagIds.join(','))
        }
        if (filterDateFrom) url.set('travelDateFrom', filterDateFrom)
        if (filterDateTo) url.set('travelDateTo', filterDateTo)
        if (page > 1) url.set('page', String(page))
        if (pageSize !== 25) url.set('pageSize', String(pageSize))
        const qs = url.toString()
        router.replace(qs ? `/travel?${qs}` : '/travel', { scroll: false })
    }, [
        search,
        filterStatusId,
        filterTagIds,
        filterDateFrom,
        filterDateTo,
        page,
        pageSize,
        router
    ])

    useEffect(() => {
        if (selectedIds.length === 0) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setBulkStatusId('')
            setBulkTagIds([])
            setBulkTagAction('add')
            /* eslint-enable react-hooks/set-state-in-effect */
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
                    statusId: Number(data.statusId),
                    travelDateFrom: data.travelDateFrom ?? '',
                    travelDateTo: data.travelDateTo ?? '',
                    tagIds: data.tagIds ?? []
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
            patch
        }: {
            id: number
            patch: {
                statusId?: number
                tagIds?: number[]
                travelDateFrom?: string
                travelDateTo?: string
            }
        }) => {
            const res = await fetch(`/api/travel/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar')
            }
            return res.json() as Promise<TravelLeadRow>
        },
        onSuccess: (updated, variables) => {
            queryClient.setQueryData<TravelLeadsResponse>(
                queryKey,
                (previous) => {
                    if (!previous) return previous
                    return {
                        ...previous,
                        data: previous.data.map((lead) =>
                            lead.id === variables.id
                                ? { ...lead, ...updated }
                                : lead
                        )
                    }
                }
            )
            invalidate()
        },
        onError: (error: Error) => {
            toast.error(error.message)
            invalidate()
        }
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

    const bulkTagsMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/travel/leads/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: selectedIds,
                    tagAction: bulkTagAction,
                    tagIds: bulkTagIds
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudieron actualizar las etiquetas')
            }
            return res.json()
        },
        onSuccess: (res: { updated: number }) => {
            toast.success(
                bulkTagAction === 'replace'
                    ? `Etiquetas reemplazadas en ${res.updated} leads`
                    : bulkTagAction === 'remove'
                      ? `Etiquetas quitadas en ${res.updated} leads`
                      : `Etiquetas agregadas en ${res.updated} leads`
            )
            setBulkTagIds([])
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
            statusId: statuses[0] ? String(statuses[0].id) : '',
            travelDateFrom: '',
            travelDateTo: '',
            tagIds: []
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
            statusId: String(lead.statusId),
            travelDateFrom: lead.travelDateFrom ?? '',
            travelDateTo: lead.travelDateTo ?? '',
            tagIds: lead.tags.map((tag) => tag.id)
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
        const headers = [
            'Nombre',
            'Email',
            'Teléfono',
            'Etiquetas',
            'Fecha desde',
            'Fecha hasta',
            'Estado'
        ]
        const escape = (field: string) =>
            /[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
        const csv =
            '\uFEFF' +
            [
                headers.join(','),
                ...rows.map((lead) =>
                    [
                        lead.name,
                        lead.email,
                        lead.phone,
                        lead.tags.map((tag) => tag.name).join(' | '),
                        lead.travelDateFrom || '',
                        lead.travelDateTo || '',
                        lead.statusName || ''
                    ]
                        .map(escape)
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
                        <div className='w-[220px]'>
                            <TagMultiSelect
                                options={travelTags}
                                selected={filterTagIds}
                                onToggle={(tagId) => {
                                    setFilterTagIds((prev) =>
                                        prev.includes(tagId)
                                            ? prev.filter((id) => id !== tagId)
                                            : [...prev, tagId]
                                    )
                                    setPage(1)
                                }}
                                placeholder='Todas las etiquetas'
                                searchPlaceholder='Buscar etiqueta...'
                                emptyMessage='No hay etiquetas de viaje.'
                                triggerClassName='h-8 text-sm'
                            />
                        </div>
                        <DateRangePicker
                            from={filterDateFrom}
                            to={filterDateTo}
                            onChange={(from, to) => {
                                setFilterDateFrom(from)
                                setFilterDateTo(to)
                                setPage(1)
                            }}
                            placeholder='Fechas de viaje'
                            className='h-8 w-[240px] text-sm'
                        />
                        {(search ||
                            filterStatusId ||
                            filterTagIds.length > 0 ||
                            filterDateFrom ||
                            filterDateTo) && (
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                    setSearch('')
                                    setFilterStatusId('')
                                    setFilterTagIds([])
                                    setFilterDateFrom('')
                                    setFilterDateTo('')
                                    setPage(1)
                                }}>
                                <X size={14} /> Limpiar filtros
                            </Button>
                        )}
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
                            <label className='text-sm text-muted-foreground'>
                                Etiquetas:
                            </label>
                            <Select
                                value={bulkTagAction}
                                items={[
                                    { value: 'add', label: 'Agregar' },
                                    { value: 'remove', label: 'Quitar' },
                                    { value: 'replace', label: 'Reemplazar' }
                                ]}
                                onValueChange={(val) =>
                                    setBulkTagAction(
                                        (val ?? 'add') as
                                            | 'add'
                                            | 'remove'
                                            | 'replace'
                                    )
                                }>
                                <SelectTrigger
                                    size='sm'
                                    className='h-7 text-xs'>
                                    <SelectValue placeholder='Agregar' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value='add'>
                                            Agregar
                                        </SelectItem>
                                        <SelectItem value='remove'>
                                            Quitar
                                        </SelectItem>
                                        <SelectItem value='replace'>
                                            Reemplazar
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <div className='w-[210px]'>
                                <TagMultiSelect
                                    options={travelTags}
                                    selected={bulkTagIds}
                                    onToggle={(tagId) =>
                                        setBulkTagIds((prev) =>
                                            prev.includes(tagId)
                                                ? prev.filter(
                                                      (id) => id !== tagId
                                                  )
                                                : [...prev, tagId]
                                        )
                                    }
                                    placeholder='Elegir etiquetas'
                                    searchPlaceholder='Buscar etiqueta...'
                                    emptyMessage='No hay etiquetas de viaje.'
                                    triggerClassName='h-7 text-xs'
                                />
                            </div>
                            <Button
                                size='xs'
                                onClick={() => {
                                    if (
                                        bulkTagIds.length === 0 &&
                                        bulkTagAction !== 'replace'
                                    ) {
                                        toast.error(
                                            'Seleccioná al menos una etiqueta'
                                        )
                                        return
                                    }
                                    bulkTagsMutation.mutate()
                                }}
                                disabled={bulkTagsMutation.isPending}>
                                {bulkTagsMutation.isPending ? (
                                    <Loader2
                                        size={14}
                                        className='animate-spin'
                                    />
                                ) : (
                                    'Aplicar'
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
                                    setBulkTagIds([])
                                    setBulkTagAction('add')
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
                                {search ||
                                filterStatusId ||
                                filterTagIds.length > 0 ||
                                filterDateFrom ||
                                filterDateTo
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
                                                Etiquetas
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Fechas de viaje
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Estado
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
                                                    <td className='py-1'>
                                                        <InlineTravelTags
                                                            tags={lead.tags}
                                                            options={
                                                                travelTags
                                                            }
                                                            onSave={(
                                                                tagIds
                                                            ) =>
                                                                inlineUpdateMutation.mutate(
                                                                    {
                                                                        id: lead.id,
                                                                        patch: {
                                                                            tagIds
                                                                        }
                                                                    }
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td className='py-1'>
                                                        <InlineTravelDates
                                                            from={
                                                                lead.travelDateFrom
                                                            }
                                                            to={
                                                                lead.travelDateTo
                                                            }
                                                            onSave={(
                                                                travelDateFrom,
                                                                travelDateTo
                                                            ) =>
                                                                inlineUpdateMutation.mutate(
                                                                    {
                                                                        id: lead.id,
                                                                        patch: {
                                                                            travelDateFrom,
                                                                            travelDateTo
                                                                        }
                                                                    }
                                                                )
                                                            }
                                                        />
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
                                                                        patch: {
                                                                            statusId:
                                                                                Number(
                                                                                    val
                                                                                )
                                                                        }
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
                            <Field>
                                <FieldLabel>Etiquetas de viaje</FieldLabel>
                                <Controller
                                    name='tagIds'
                                    control={form.control}
                                    render={({ field }) => (
                                        <TagMultiSelect
                                            options={travelTags}
                                            selected={field.value ?? []}
                                            onToggle={(tagId) => {
                                                const current =
                                                    field.value ?? []
                                                field.onChange(
                                                    current.includes(tagId)
                                                        ? current.filter(
                                                              (id) =>
                                                                  id !== tagId
                                                          )
                                                        : [...current, tagId]
                                                )
                                            }}
                                            placeholder='Destinos, paquetes o intereses'
                                            searchPlaceholder='Buscar etiqueta...'
                                            emptyMessage='No hay etiquetas de viaje. Creá algunas en Administración.'
                                            triggerClassName='h-9 text-sm'
                                            maxChips={3}
                                        />
                                    )}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>
                                    Fecha estimada de viaje
                                </FieldLabel>
                                <DateRangePicker
                                    from={travelDateFromValue}
                                    to={travelDateToValue}
                                    onChange={(from, to) => {
                                        form.setValue(
                                            'travelDateFrom',
                                            from,
                                            { shouldDirty: true }
                                        )
                                        form.setValue('travelDateTo', to, {
                                            shouldDirty: true
                                        })
                                    }}
                                    placeholder='¿De cuándo a cuándo puede viajar?'
                                    className='h-9'
                                />
                            </Field>
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

function InlineTravelTags({
    tags,
    options,
    onSave
}: {
    tags: TagOption[]
    options: TagOption[]
    onSave: (tagIds: number[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<number[]>(() =>
        tags.map((tag) => tag.id)
    )
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setSelected(tags.map((tag) => tag.id))
        setDirty(false)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [tags])

    const visibleOptions = query.trim()
        ? options.filter((tag) =>
              tag.name.toLowerCase().includes(query.trim().toLowerCase())
          )
        : options

    const displayTags = (dirty ? selected : tags.map((tag) => tag.id))
        .map(
            (id) =>
                options.find((tag) => tag.id === id) ??
                tags.find((tag) => tag.id === id)
        )
        .filter((tag): tag is TagOption => Boolean(tag))

    const toggle = (id: number) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
        )
        setDirty(true)
    }

    const closeAndSave = () => {
        if (dirty) onSave(selected)
        setOpen(false)
        setQuery('')
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpen(true)
                } else {
                    closeAndSave()
                }
            }}>
            <PopoverTrigger
                render={
                    <button
                        type='button'
                        title='Editar etiquetas'
                        className='group flex min-h-7 w-full max-w-[220px] items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted'
                    />
                }>
                {displayTags.length > 0 ? (
                    <span className='flex flex-wrap gap-1'>
                        {displayTags.map((tag) => (
                            <TagPill key={tag.id} tag={tag} />
                        ))}
                    </span>
                ) : (
                    <span className='text-xs text-muted-foreground'>—</span>
                )}
                <Pencil
                    size={12}
                    className='ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'
                />
            </PopoverTrigger>
            <PopoverContent align='start' className='w-64 gap-0 p-0'>
                <div className='border-b p-2'>
                    <div className='relative'>
                        <Search
                            size={14}
                            className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                        />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder='Buscar etiqueta...'
                            className='h-7 pl-8 text-xs'
                        />
                    </div>
                </div>
                <div className='max-h-56 overflow-y-auto p-1'>
                    {visibleOptions.length === 0 ? (
                        <p className='px-2 py-3 text-center text-xs text-muted-foreground'>
                            No hay etiquetas de viaje.
                        </p>
                    ) : (
                        visibleOptions.map((tag) => {
                            const active = selected.includes(tag.id)
                            return (
                                <button
                                    key={tag.id}
                                    type='button'
                                    onClick={() => toggle(tag.id)}
                                    className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground'>
                                    <span
                                        className={
                                            active
                                                ? 'flex size-4 shrink-0 items-center justify-center rounded-[4px] text-white'
                                                : 'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input'
                                        }
                                        style={
                                            active
                                                ? {
                                                      backgroundColor:
                                                          tag.color ||
                                                          '#6b7280'
                                                  }
                                                : undefined
                                        }>
                                        {active && <Check size={12} />}
                                    </span>
                                    <span className='flex-1 truncate'>
                                        {tag.name}
                                    </span>
                                </button>
                            )
                        })
                    )}
                </div>
                <div className='flex items-center justify-between gap-2 border-t px-2 py-1.5'>
                    <span className='text-xs text-muted-foreground'>
                        {selected.length} seleccionada
                        {selected.length === 1 ? '' : 's'}
                    </span>
                    <div className='flex items-center gap-1'>
                        {selected.length > 0 && (
                            <Button
                                type='button'
                                size='xs'
                                variant='ghost'
                                onClick={() => {
                                    setSelected([])
                                    setDirty(true)
                                }}>
                                Limpiar
                            </Button>
                        )}
                        <Button
                            type='button'
                            size='xs'
                            onClick={closeAndSave}>
                            Guardar
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

function InlineTravelDates({
    from,
    to,
    onSave
}: {
    from: string | null
    to: string | null
    onSave: (from: string, to: string) => void
}) {
    const [range, setRange] = useState({ from: from ?? '', to: to ?? '' })
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setRange({ from: from ?? '', to: to ?? '' })
        setDirty(false)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [from, to])

    const displayFrom = dirty ? range.from : (from ?? '')
    const displayTo = dirty ? range.to : (to ?? '')

    return (
        <DateRangePicker
            from={displayFrom}
            to={displayTo}
            placeholder='—'
            className='h-7 w-auto max-w-[190px] border-transparent bg-transparent px-1 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground'
            onChange={(nextFrom, nextTo) => {
                setRange({ from: nextFrom, to: nextTo })
                setDirty(true)
            }}
            onOpenChange={(next) => {
                if (next) return
                const changed =
                    range.from !== (from ?? '') || range.to !== (to ?? '')
                if (dirty && changed) {
                    onSave(range.from, range.to)
                }
            }}
        />
    )
}
