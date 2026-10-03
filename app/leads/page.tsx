'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileUp,
    CalendarClock,
    Loader2,
    Mail,
    MessageCircle,
    MessageSquareText,
    Pencil,
    Plus,
    Search,
    SlidersHorizontal,
    UserPlus,
    X
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
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
import { TagPill, TagSelect, type TagOption } from '@/components/tags'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { CreateEventDialog } from '@/components/events/event-form'
import { useSession } from '@/hooks/use-session'
import { COUNTRY_OPTIONS } from '@/lib/countries'

interface StatusOption {
    id: number
    status: string
    color: string
    isActive: number
}

interface PriorityOption {
    id: number
    priority: string
    color: string
    isActive: number
}

interface UserOption {
    id: string
    name: string | null
    email: string
    image: string | null
}

interface ReferralOption {
    id: number
    code: string
}

interface LabelOption {
    id: number
    name: string
    color: string
}

interface CustomerRow {
    id: number
    name: string
    phone: string
    email: string
    travelTime: string
    country: string | null
    statusId: number
    priorityId: number
    assignedTo: string
    referralId: number | null
    createdAt: string | null
    updatedAt: string | null
    statusName: string | null
    statusIsActive: number | null
    statusColor: string | null
    priorityName: string | null
    priorityIsActive: number | null
    priorityColor: string | null
    assignedUserName: string | null
    assignedUserEmail: string | null
    assignedUserImage: string | null
    tags: TagOption[]
}

interface CustomersResponse {
    data: CustomerRow[]
    total: number
    page: number
    pageSize: number
}

interface LabelOption {
    id: number
    name: string
    color: string
}

const travelTimeLabels: Record<string, string> = {
    '0-3': 'Lo antes posible',
    '3-6': 'En 3-6 meses',
    '6-12': 'En 6-12 meses',
    '12-18': 'En 12-18 meses',
    '0': 'Solo explorando'
}

const customerSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(1, 'El teléfono es obligatorio'),
    travelTime: z.string().min(1, 'El tiempo de viaje es obligatorio'),
    country: z.string().optional(),
    statusId: z.string().min(1),
    priorityId: z.string().min(1),
    assignedTo: z.string().optional(),
    referralId: z.string().optional()
})

type CustomerFormValues = z.infer<typeof customerSchema>

function ColorDot({ color }: { color: string }) {
    return (
        <span
            className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
            style={{ backgroundColor: color || '#6b7280' }}
        />
    )
}

export default function Home() {
    return (
        <Suspense
            fallback={
                <GlobeLoader fullScreen={false} className='min-h-[70vh]' />
            }>
            <HomeContent />
        </Suspense>
    )
}

function HomeContent() {
    const queryClient = useQueryClient()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { session, isPending: sessionLoading } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [search, setSearch] = useState(searchParams.get('search') ?? '')
    const [filterStatusId, setFilterStatusId] = useState(
        searchParams.get('statusId') ?? '1'
    )
    const [filterPriorityId, setFilterPriorityId] = useState(
        searchParams.get('priorityId') ?? ''
    )
    const [filterAssignedTo, setFilterAssignedTo] = useState(
        searchParams.get('assignedTo') ?? ''
    )
    const [filterTagId, setFilterTagId] = useState(
        searchParams.get('tagId') ?? ''
    )
    const initialFilterRef = useRef(false)
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
    const [pageSize, setPageSize] = useState(
        Number(searchParams.get('pageSize')) || 25
    )
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )

    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
    const [eventCustomerId, setEventCustomerId] = useState<number | null>(null)

    const [classifyModalOpen, setClassifyModalOpen] = useState(false)
    const [classifyingId, setClassifyingId] = useState<number | null>(null)
    const [classifyStatusId, setClassifyStatusId] = useState('1')
    const [classifyPriorityId, setClassifyPriorityId] = useState('1')
    const [classifyReferralId, setClassifyReferralId] = useState('')
    const [classifyAssignedTo, setClassifyAssignedTo] = useState('')
    const [classifyTagIds, setClassifyTagIds] = useState<number[]>([])

    const [bulkStatusId, setBulkStatusId] = useState('')
    const [bulkPriorityId, setBulkPriorityId] = useState('')
    const [bulkAssignedTo, setBulkAssignedTo] = useState('')
    const [bulkTagId, setBulkTagId] = useState('')

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            travelTime: '',
            country: '',
            statusId: '1',
            priorityId: '1',
            assignedTo: '',
            referralId: ''
        }
    })

    const queryKey = [
        'customers',
        search,
        filterStatusId,
        filterPriorityId,
        filterAssignedTo,
        filterTagId,
        page,
        pageSize
    ] as const

    const { data: customersData, isLoading } = useQuery<CustomersResponse>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (filterStatusId) params.set('statusId', filterStatusId)
            if (filterPriorityId) params.set('priorityId', filterPriorityId)
            if (filterAssignedTo) params.set('assignedTo', filterAssignedTo)
            if (filterTagId) params.set('tagIds', filterTagId)
            params.set('page', String(page))
            params.set('pageSize', String(pageSize))

            const res = await fetch(`/api/customers?${params.toString()}`)
            if (!res.ok) throw new Error('No se pudo cargar')
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery({
        queryKey: ['statuses'],
        queryFn: () => fetch('/api/status').then((r) => r.json()),
        select: (data: StatusOption[]) =>
            data.map((s) => ({
                id: s.id,
                name: s.status,
                color: s.color || '#6b7280'
            }))
    }) as { data: LabelOption[] | undefined }

    const { data: priorities = [] } = useQuery({
        queryKey: ['priorities'],
        queryFn: () => fetch('/api/priority').then((r) => r.json()),
        select: (data: PriorityOption[]) =>
            data.map((p) => ({
                id: p.id,
                name: p.priority,
                color: p.color || '#6b7280'
            }))
    }) as { data: LabelOption[] | undefined }

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then((r) => r.json()),
        select: (data: UserOption[]) =>
            data.map((u) => ({
                id: u.id,
                name: u.name || u.email
            })),
        enabled: isAdmin
    }) as { data: { id: string; name: string }[] | undefined }

    const { data: referralOptions = [] } = useQuery({
        queryKey: ['referrals'],
        queryFn: () => fetch('/api/referrals').then((r) => r.json()),
        select: (data: ReferralOption[]) =>
            data.map((r) => ({
                id: r.id,
                name: r.code
            })),
        enabled: isAdmin
    })

    const { data: tagOptions = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: () => fetch('/api/tags').then((r) => r.json()),
        select: (data: Array<{
            id: number
            tag: string
            color: string
            isActive: number
        }>) =>
            data
                .filter((t) => t.isActive)
                .map((t) => ({
                    id: t.id,
                    name: t.tag,
                    color: t.color || '#6b7280',
                    isActive: t.isActive
                }))
    }) as { data: TagOption[] | undefined }

    useEffect(() => {
        if (initialFilterRef.current || !session?.user.id) return
        if (searchParams.get('assignedTo') === null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFilterAssignedTo(session.user.id)
        }
        initialFilterRef.current = true
    }, [session?.user.id, searchParams])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setPage(1), 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [search, filterStatusId, filterPriorityId, filterAssignedTo, filterTagId])

    useEffect(() => {
        const url = new URLSearchParams()
        if (search) url.set('search', search)
        if (filterStatusId) url.set('statusId', filterStatusId)
        if (filterPriorityId) url.set('priorityId', filterPriorityId)
        if (filterAssignedTo) url.set('assignedTo', filterAssignedTo)
        if (filterTagId) url.set('tagId', filterTagId)
        if (page > 1) url.set('page', String(page))
        if (pageSize !== 25) url.set('pageSize', String(pageSize))
        const qs = url.toString()
        router.replace(qs ? `/leads?${qs}` : '/leads', { scroll: false })
    }, [
        search,
        filterStatusId,
        filterPriorityId,
        filterAssignedTo,
        filterTagId,
        page,
        pageSize,
        router
    ])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (selectedIds.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBulkStatusId('')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBulkPriorityId('')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBulkAssignedTo('')
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBulkTagId('')
        }
    }, [selectedIds])

    const customers = customersData?.data ?? []
    const total = customersData?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['customers'] })

    const updateMutation = useMutation({
        mutationFn: async ({
            id,
            ...data
        }: {
            id: number
            [key: string]: string | number | null | undefined
        }) => {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
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

    const classifyMutation = useMutation({
        mutationFn: async () => {
            if (classifyingId === null) {
                throw new Error('No hay cliente seleccionado')
            }
            const body: Record<string, string | number | null | number[]> = {
                statusId: Number(classifyStatusId),
                priorityId: Number(classifyPriorityId),
                tagIds: classifyTagIds
            }
            if (isAdmin) {
                body.assignedTo = classifyAssignedTo || session?.user.id
                body.referralId = classifyReferralId
                    ? Number(classifyReferralId)
                    : null
            }
            const res = await fetch(`/api/customers/${classifyingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Clasificación actualizada')
            setClassifyModalOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openClassify = (customer: CustomerRow) => {
        setClassifyingId(customer.id)
        setClassifyStatusId(String(customer.statusId))
        setClassifyPriorityId(String(customer.priorityId))
        setClassifyReferralId(
            customer.referralId ? String(customer.referralId) : ''
        )
        setClassifyAssignedTo(customer.assignedTo || '')
        setClassifyTagIds(
            customer.tags.filter((t) => t.isActive).map((t) => t.id)
        )
        setClassifyModalOpen(true)
    }

    const bulkMutation = useMutation({
        mutationFn: async (data: {
            ids: number[]
            statusId?: number
            priorityId?: number
            assignedTo?: string
            tagIds?: number[]
        }) => {
            const res = await fetch('/api/customers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar en lote')
            }
            return res.json()
        },
        onSuccess: (res: { updated: number }) => {
            toast.success(`${res.updated} clientes actualizados`)
            setSelectedIds([])
            setBulkStatusId('')
            setBulkPriorityId('')
            setBulkAssignedTo('')
            setBulkTagId('')
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const saveMutation = useMutation({
        mutationFn: async (data: CustomerFormValues) => {
            const isEdit = editingId !== null
            const url = isEdit
                ? `/api/customers/${editingId}`
                : '/api/customers'
            const method = isEdit ? 'PUT' : 'POST'
            const body = {
                name: data.name,
                email: data.email,
                phone: data.phone,
                travelTime: data.travelTime,
                country: data.country,
                statusId: Number(data.statusId),
                priorityId: Number(data.priorityId),
                assignedTo: data.assignedTo,
                referralId:
                    isEdit && data.referralId ? Number(data.referralId) : null,
                tagIds: selectedTagIds
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo guardar')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success(
                `Customer ${editingId ? 'updated' : 'created'} successfully`
            )
            setModalOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openCreate = () => {
        setEditingId(null)
        form.reset({
            name: '',
            email: '',
            phone: '',
            travelTime: '',
            country: '',
            statusId: '1',
            priorityId: '1',
            assignedTo: session?.user.id || ''
        })
        setSelectedTagIds([])
        setModalOpen(true)
    }

    const openEdit = (customer: CustomerRow) => {
        setEditingId(customer.id)
        form.reset({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            travelTime: customer.travelTime,
            country: customer.country || '',
            statusId: String(customer.statusId),
            priorityId: String(customer.priorityId),
            assignedTo: customer.assignedTo || '',
            referralId: customer.referralId ? String(customer.referralId) : ''
        })
        setSelectedTagIds(
            customer.tags.filter((t) => t.isActive).map((t) => t.id)
        )
        setModalOpen(true)
    }

    const onSubmit = (data: CustomerFormValues) => saveMutation.mutate(data)

    const toggleTag = (id: number) => {
        setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const toggleClassifyTag = (id: number) => {
        setClassifyTagIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === customers.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(customers.map((c) => c.id))
        }
    }

    const handleInlineUpdate = (
        id: number,
        field: string,
        value: string | number
    ) => {
        updateMutation.mutate({ id, [field]: value })
    }

    if (sessionLoading) {
        return <GlobeLoader fullScreen={false} className='py-32' />
    }

    if (!session) {
        return (
            <div className='flex flex-col items-center justify-center py-32 text-center'>
                <UserPlus size={48} className='mb-4 text-muted-foreground' />
                <h2 className='mb-2 text-xl font-medium'>Welcome to AIR CRM</h2>
                <p className='mb-6 text-muted-foreground'>
                    Iniciá sesión para gestionar tus clientes
                </p>
                <Link href='/signin'>
                    <Button>Iniciar sesión</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className='container mx-auto p-6'>
            <Card>
                <CardHeader>
                    <div className='flex items-center justify-between'>
                        <div>
                            <CardTitle>Clientes</CardTitle>
                            <p className='mt-0.5 text-sm text-muted-foreground'>
                                {total} cliente{total !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className='flex items-center gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                title='Copiar nombre y teléfono de los leads visibles'
                                onClick={async () => {
                                    const lines = customers
                                        .map((c) => {
                                            const firstName =
                                                c.name?.trim().split(/\s+/)[0] ??
                                                ''
                                            const capitalized =
                                                (firstName.charAt(0).toUpperCase() +
                                                firstName.slice(1).toLowerCase()) ||
                                                'Sin nombre'
                                            return `${capitalized}, ${c.phone}`
                                        })
                                        .filter((line) => line.trim())
                                    if (lines.length === 0) {
                                        toast.error(
                                            'No hay leads para copiar'
                                        )
                                        return
                                    }
                                    try {
                                        await navigator.clipboard.writeText(
                                            lines.join('\n')
                                        )
                                        toast.success(
                                            `${lines.length} contactos copiados al portapapeles`
                                        )
                                    } catch {
                                        toast.error(
                                            'No se pudo copiar los contactos'
                                        )
                                    }
                                }}>
                                <MessageSquareText size={16} /> Copiar remitente WA
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                title='Copiar los correos de los leads visibles'
                                onClick={async () => {
                                    const emails = customers
                                        .map((c) => c.email)
                                        .filter(Boolean)
                                        .join(', ')
                                    if (!emails) {
                                        toast.error(
                                            'No hay leads para copiar'
                                        )
                                        return
                                    }
                                    try {
                                        await navigator.clipboard.writeText(
                                            emails
                                        )
                                        toast.success(
                                            `${customers.length} correos copiados al portapapeles`
                                        )
                                    } catch {
                                        toast.error(
                                            'No se pudo copiar los correos'
                                        )
                                    }
                                }}>
                                <Mail size={16} /> Copiar correos
                            </Button>
                            <Link href='/leads/import'>
                                <Button variant='outline' size='sm'>
                                    <FileUp size={16} /> Importar CSV
                                </Button>
                            </Link>
                            <Button onClick={openCreate} size='sm'>
                                <Plus /> Nuevo cliente
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='mb-4 flex flex-wrap items-center gap-2'>
                        <div className='relative min-w-[200px] flex-1'>
                            <Search
                                size={16}
                                className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                            />
                            <Input
                                type='text'
                                placeholder='Buscar por nombre, email o teléfono...'
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
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
                            value={
                                statuses.find(
                                    (s) => s.id === Number(filterStatusId)
                                )?.name || ''
                            }
                            onValueChange={(val) => {
                                setFilterStatusId(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[150px]'>
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
                                            value={String(s.id)}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select
                            value={
                                priorities.find(
                                    (p) => p.id === Number(filterPriorityId)
                                )?.name || ''
                            }
                            onValueChange={(val) => {
                                setFilterPriorityId(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[150px]'>
                                <SelectValue placeholder='Todas las prioridades' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value=''>
                                        Todas las prioridades
                                    </SelectItem>
                                    {priorities.map((p) => (
                                        <SelectItem
                                            key={p.id}
                                            value={String(p.id)}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {isAdmin && (
                            <Select
                                value={
                                    users.find((u) => u.id === filterAssignedTo)
                                        ?.name || ''
                                }
                                onValueChange={(val) => {
                                    setFilterAssignedTo(val ?? '')
                                    setPage(1)
                                }}>
                                <SelectTrigger className='h-8 w-[150px]'>
                                    <SelectValue placeholder='Todos los usuarios' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            Todos los usuarios
                                        </SelectItem>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        )}
                        <Select
                            value={
                                tagOptions.find(
                                    (t) => t.id === Number(filterTagId)
                                )?.name || ''
                            }
                            onValueChange={(val) => {
                                setFilterTagId(val ?? '')
                                setPage(1)
                            }}>
                            <SelectTrigger className='h-8 w-[150px]'>
                                <SelectValue placeholder='Todas las etiquetas' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value=''>All Tags</SelectItem>
                                    {tagOptions.map((t) => (
                                        <SelectItem
                                            key={t.id}
                                            value={String(t.id)}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className='mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2'>
                            <span className='text-sm font-medium'>
                                {selectedIds.length} selected
                            </span>
                            <span className='text-muted-foreground'>|</span>
                            <label className='text-sm text-muted-foreground'>
                                Estado:
                            </label>
                            <Select
                                value={
                                    statuses
                                        .find(
                                            (s) => s.id === Number(bulkStatusId)
                                        )
                                        ?.name.toString() || ''
                                }
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
                            <label className='text-sm text-muted-foreground'>
                                Prioridad:
                            </label>
                            <Select
                                value={
                                    priorities
                                        .find(
                                            (p) =>
                                                p.id === Number(bulkPriorityId)
                                        )
                                        ?.name.toString() || ''
                                }
                                onValueChange={(val) => {
                                    setBulkPriorityId(val ?? '')
                                }}>
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
                                        {priorities.map((p) => (
                                            <SelectItem
                                                key={p.id}
                                                value={String(p.id)}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {isAdmin && (
                                <>
                                    <label className='text-sm text-muted-foreground'>
                                        Asignar a:
                                    </label>
                                    <Select
                                        value={
                                            users
                                                .find(
                                                    (u) =>
                                                        u.id === bulkAssignedTo
                                                )
                                                ?.name.toString() || ''
                                        }
                                        onValueChange={(val) =>
                                            setBulkAssignedTo(val ?? '')
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
                                                {users.map((u) => (
                                                    <SelectItem
                                                        key={u.id}
                                                        value={u.id}>
                                                        {u.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                            <label className='text-sm text-muted-foreground'>
                                Etiqueta:
                            </label>
                            <Select
                                value={
                                    tagOptions.find(
                                        (t) => t.id === Number(bulkTagId)
                                    )?.name.toString() || ''
                                }
                                onValueChange={(val) => setBulkTagId(val ?? '')}>
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
                                        {tagOptions.map((t) => (
                                            <SelectItem
                                                key={t.id}
                                                value={String(t.id)}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button
                                size='xs'
                                onClick={() => {
                                    if (
                                        !bulkStatusId &&
                                        !bulkPriorityId &&
                                        !bulkAssignedTo &&
                                        !bulkTagId
                                    ) {
                                        toast.error(
                                            'Seleccioná al menos un cambio'
                                        )
                                        return
                                    }
                                    bulkMutation.mutate({
                                        ids: selectedIds,
                                        ...(bulkStatusId && {
                                            statusId: Number(bulkStatusId)
                                        }),
                                        ...(bulkPriorityId && {
                                            priorityId: Number(bulkPriorityId)
                                        }),
                                        ...(bulkAssignedTo && {
                                            assignedTo: bulkAssignedTo
                                        }),
                                        ...(bulkTagId && {
                                            tagIds: [Number(bulkTagId)]
                                        })
                                    })
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
                                onClick={() => {
                                    const selected = customers.filter((c) =>
                                        selectedIds.includes(c.id)
                                    )
                                    const headers = [
                                        'Nombre',
                                        'Email',
                                        'Teléfono',
                                        'Tiempo de viaje',
                                        'Estado',
                                        'Prioridad',
                                        'Asignado a'
                                    ]
                                    const csv =
                                        '\uFEFF' +
                                        [
                                            headers.join(','),
                                            ...selected.map((c) =>
                                                [
                                                    c.name,
                                                    c.email,
                                                    c.phone,
                                                    c.travelTime,
                                                    c.statusName || '',
                                                    c.priorityName || '',
                                                    c.assignedUserName || ''
                                                ]
                                                    .map((f) =>
                                                        f.includes(',')
                                                            ? `"${f}"`
                                                            : f
                                                    )
                                                    .join(',')
                                            )
                                        ].join('\n')
                                    const blob = new Blob([csv], {
                                        type: 'text/csv;charset=utf-8;'
                                    })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = 'contacts.csv'
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}>
                                Exportar CSV
                            </Button>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => {
                                    const selected = customers.filter((c) =>
                                        selectedIds.includes(c.id)
                                    )
                                    const rows = selected.map((c) => {
                                        const firstName = c.name.split(' ')[0]
                                        const phone = c.phone.replace(/\s/g, '')
                                        return `${firstName},${phone}`
                                    })
                                    const csv =
                                        '\uFEFF' +
                                        ['First Name,Phone', ...rows].join('\n')
                                    const blob = new Blob([csv], {
                                        type: 'text/csv;charset=utf-8;'
                                    })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = 'wa-sender.csv'
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}>
                                Remitente WA
                            </Button>
                            <Button
                                size='xs'
                                variant='ghost'
                                className='text-muted-foreground'
                                onClick={() => {
                                    setSelectedIds([])
                                    setBulkStatusId('')
                                    setBulkPriorityId('')
                                    setBulkAssignedTo('')
                                    setBulkTagId('')
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
                    ) : customers.length === 0 ? (
                        <div className='py-16 text-center'>
                            <p className='text-muted-foreground'>
                                {search ||
                                filterStatusId ||
                                filterPriorityId ||
                                filterTagId
                                    ? 'Ningún cliente coincide con tus filtros'
                                    : 'Todavía no hay clientes. ¡Creá el primero!'}
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
                                                            customers.length &&
                                                        customers.length > 0
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
                                                Estado
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Prioridad
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Etiquetas
                                            </th>
                                            {isAdmin && (
                                                <th className='pb-2 font-medium'>
                                                    Asignado a
                                                </th>
                                            )}
                                            <th className='pb-2 font-medium text-right'>
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customers.map((customer) => {
                                            const statusColor =
                                                customer.statusColor ||
                                                '#6b7280'
                                            const priorityColor =
                                                customer.priorityColor ||
                                                '#6b7280'
                                            return (
                                                <tr
                                                    key={customer.id}
                                                    className={`border-b last:border-0 transition-colors hover:bg-muted/50 ${
                                                        selectedIds.includes(
                                                            customer.id
                                                        )
                                                            ? 'bg-primary/5'
                                                            : ''
                                                    }`}>
                                                    <td className='py-2.5'>
                                                        <Checkbox
                                                            checked={selectedIds.includes(
                                                                customer.id
                                                            )}
                                                            onCheckedChange={() =>
                                                                toggleSelect(
                                                                    customer.id
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td className='py-2.5 font-medium'>
                                                        <Link
                                                            href={`/customers/${customer.id}`}
                                                            className='hover:underline'>
                                                            {customer.name}
                                                        </Link>
                                                    </td>
                                                    <td className='py-2.5 text-muted-foreground'>
                                                        <button
                                                            type='button'
                                                            title='Copiar email'
                                                            className='cursor-pointer text-left hover:underline'
                                                            onClick={async () => {
                                                                try {
                                                                    await navigator.clipboard.writeText(
                                                                        customer.email
                                                                    )
                                                                    toast.success(
                                                                        'Email copiado al portapapeles'
                                                                    )
                                                                } catch {
                                                                    toast.error(
                                                                        'No se pudo copiar el email'
                                                                    )
                                                                }
                                                            }}>
                                                            {customer.email}
                                                        </button>
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <button
                                                            type='button'
                                                            title='Copiar teléfono'
                                                            className='cursor-pointer hover:underline'
                                                            onClick={async () => {
                                                                try {
                                                                    await navigator.clipboard.writeText(
                                                                        customer.phone
                                                                    )
                                                                    toast.success(
                                                                        'Teléfono copiado al portapapeles'
                                                                    )
                                                                } catch {
                                                                    toast.error(
                                                                        'No se pudo copiar el teléfono'
                                                                    )
                                                                }
                                                            }}>
                                                            {customer.phone}
                                                        </button>
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <Select
                                                            value={String(
                                                                customer.statusId
                                                            )}
                                                            onValueChange={(
                                                                val:
                                                                    | string
                                                                    | null
                                                            ) =>
                                                                handleInlineUpdate(
                                                                    customer.id,
                                                                    'statusId',
                                                                    Number(val)
                                                                )
                                                            }>
                                                            <SelectTrigger className='h-7 max-w-[130px] text-xs gap-1'>
                                                                <ColorDot
                                                                    color={
                                                                        statusColor
                                                                    }
                                                                />
                                                                <SelectValue>
                                                                    {customer.statusName ||
                                                                        String(
                                                                            customer.statusId
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
                                                    <td className='py-2.5'>
                                                        <Select
                                                            value={String(
                                                                customer.priorityId
                                                            )}
                                                            onValueChange={(
                                                                val:
                                                                    | string
                                                                    | null
                                                            ) =>
                                                                handleInlineUpdate(
                                                                    customer.id,
                                                                    'priorityId',
                                                                    Number(val)
                                                                )
                                                            }>
                                                            <SelectTrigger className='h-7 max-w-[130px] text-xs gap-1'>
                                                                <ColorDot
                                                                    color={
                                                                        priorityColor
                                                                    }
                                                                />
                                                                <SelectValue>
                                                                    {customer.priorityName ||
                                                                        String(
                                                                            customer.priorityId
                                                                        )}
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectGroup>
                                                                    {priorities.map(
                                                                        (p) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    p.id
                                                                                }
                                                                                value={String(
                                                                                    p.id
                                                                                )}>
                                                                                <ColorDot
                                                                                    color={
                                                                                        p.color
                                                                                    }
                                                                                />
                                                                                {
                                                                                    p.name
                                                                                }
                                                                            </SelectItem>
                                                                        )
                                                                    )}
                                                                </SelectGroup>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <div className='flex max-w-[220px] flex-wrap gap-1'>
                                                            {customer.tags
                                                                .filter(
                                                                    (t) =>
                                                                        t.isActive
                                                                )
                                                                .map((t) => (
                                                                    <TagPill
                                                                        key={
                                                                            t.id
                                                                        }
                                                                        tag={t}
                                                                    />
                                                                ))}
                                                        </div>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className='py-2.5'>
                                                            <Select
                                                                value={
                                                                    customer.assignedTo
                                                                }
                                                                onValueChange={(
                                                                    val:
                                                                        | string
                                                                        | null
                                                                ) =>
                                                                    handleInlineUpdate(
                                                                        customer.id,
                                                                        'assignedTo',
                                                                        val ||
                                                                            ''
                                                                    )
                                                                }>
                                                                <SelectTrigger className='h-7 max-w-[150px] text-xs'>
                                                                    <SelectValue>
                                                                        {customer.assignedUserName ||
                                                                            'Unassigned'}
                                                                    </SelectValue>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectGroup>
                                                                        {users.map(
                                                                            (
                                                                                u
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        u.id
                                                                                    }
                                                                                    value={
                                                                                        u.id
                                                                                    }>
                                                                                    {
                                                                                        u.name
                                                                                    }
                                                                                </SelectItem>
                                                                            )
                                                                        )}
                                                                    </SelectGroup>
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                    )}
                                                    <td className='py-2.5 text-right'>
                                                        <div className='flex items-center justify-end gap-1'>
                                                            <a
                                                                href={`https://web.whatsapp.com/send/?phone=${customer.phone.replace(/\D/g, '')}&text&type=phone_number&app_absent=0`}
                                                                target='_blank'
                                                                rel='noopener noreferrer'>
                                                                <Button
                                                                    size='icon-sm'
                                                                    variant='ghost'
                                                                    className='text-green-600 hover:text-green-700'>
                                                                    <MessageCircle
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </Button>
                                                            </a>
                                                            <Link
                                                                href={`/customers/${customer.id}`}>
                                                                <Button
                                                                    size='icon-sm'
                                                                    variant='ghost'>
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
                                                                title='Agregar evento'
                                                                onClick={() =>
                                                                    setEventCustomerId(
                                                                        customer.id
                                                                    )
                                                                }>
                                                                <CalendarClock
                                                                    size={14}
                                                                />
                                                            </Button>
                                                            <Button
                                                                size='icon-sm'
                                                                variant='ghost'
                                                                title='Editar estado, prioridad y referido'
                                                                onClick={() =>
                                                                    openClassify(
                                                                        customer
                                                                    )
                                                                }>
                                                                <SlidersHorizontal
                                                                    size={14}
                                                                />
                                                            </Button>
                                                            <Button
                                                                size='icon-sm'
                                                                variant='ghost'
                                                                onClick={() =>
                                                                    openEdit(
                                                                        customer
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
                <DialogContent className='max-h-[90vh] sm:max-w-lg overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Editar' : 'Nuevo'} cliente
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? 'Actualizá los datos del cliente.'
                                : 'Ingresá los datos del nuevo cliente.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className='grid gap-4'>
                        <FieldGroup>
                            <Controller
                                name='name'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='name'>
                                            Nombre
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='name'
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
                                name='email'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='email'>
                                            Email
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='email'
                                            type='email'
                                            placeholder='customer@example.com'
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
                                        <FieldLabel htmlFor='phone'>
                                            Teléfono
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='phone'
                                            type='tel'
                                            placeholder='+1 (555) 000-0000'
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
                                name='travelTime'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='travelTime'>
                                            Tiempo de viaje
                                        </FieldLabel>
                                        <Select
                                            value={
                                                travelTimeLabels[field.value] ||
                                                field.value
                                            }
                                            onValueChange={field.onChange}>
                                            <SelectTrigger
                                                id='travelTime'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }>
                                                <SelectValue placeholder='Seleccionar...' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value='0-3'>
                                                        Lo antes posible
                                                    </SelectItem>
                                                    <SelectItem value='3-6'>
                                                        En 3-6 meses
                                                    </SelectItem>
                                                    <SelectItem value='6-12'>
                                                        En 6-12 meses
                                                    </SelectItem>
                                                    <SelectItem value='12-18'>
                                                        En 12-18 meses
                                                    </SelectItem>
                                                    <SelectItem value='0'>
                                                        Solo explorando
                                                    </SelectItem>
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
                            <Controller
                                name='country'
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='country'>
                                            País
                                        </FieldLabel>
                                        <Select
                                            value={field.value || ''}
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='country'>
                                                <SelectValue placeholder='No especificado' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {COUNTRY_OPTIONS.map(
                                                        (country) => (
                                                            <SelectItem
                                                                key={country}
                                                                value={country}>
                                                                {country}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                            <Controller
                                name='statusId'
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='statusId'>
                                            Estado
                                        </FieldLabel>
                                        <Select
                                            value={
                                                statuses.find(
                                                    (s) =>
                                                        s.id ===
                                                        Number(field.value)
                                                )?.name || ''
                                            }
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='statusId'>
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
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                            <Controller
                                name='priorityId'
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='priorityId'>
                                            Prioridad
                                        </FieldLabel>
                                        <Select
                                            value={
                                                priorities
                                                    .find(
                                                        (p) =>
                                                            p.id ===
                                                            Number(field.value)
                                                    )
                                                    ?.name.toString() || ''
                                            }
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='priorityId'>
                                                <SelectValue placeholder='Seleccionar...' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {priorities.map((p) => (
                                                        <SelectItem
                                                            key={p.id}
                                                            value={String(
                                                                p.id
                                                            )}>
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                            {isAdmin && (
                                <Controller
                                    name='assignedTo'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='assignedTo'>
                                                Asignado a
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    users.find(
                                                        (u) =>
                                                            u.id === field.value
                                                    )?.name || ''
                                                }
                                                onValueChange={field.onChange}>
                                                <SelectTrigger id='assignedTo'>
                                                    <SelectValue placeholder='Seleccionar...' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        {users.map((u) => (
                                                            <SelectItem
                                                                key={u.id}
                                                                value={u.id}>
                                                                {u.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                            )}
                            {isAdmin && editingId && (
                                <Controller
                                    name='referralId'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='referralId'>
                                                Código de referido
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    referralOptions.find(
                                                        (r) =>
                                                            r.id ===
                                                            Number(field.value)
                                                    )?.name || ''
                                                }
                                                onValueChange={field.onChange}>
                                                <SelectTrigger id='referralId'>
                                                    <SelectValue placeholder='Seleccionar...' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            Ninguno
                                                        </SelectItem>
                                                        {referralOptions.map(
                                                            (r) => (
                                                                <SelectItem
                                                                    key={r.id}
                                                                    value={String(
                                                                        r.id
                                                                    )}>
                                                                    {r.name}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                            )}
                            <Field>
                                <FieldLabel>Etiquetas</FieldLabel>
                                <TagSelect
                                    options={tagOptions}
                                    selected={selectedTagIds}
                                    onToggle={toggleTag}
                                />
                            </Field>
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
                                    'Actualizar cliente'
                                ) : (
                                    'Crear cliente'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={classifyModalOpen}
                onOpenChange={setClassifyModalOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Editar clasificación</DialogTitle>
                        <DialogDescription>
                            Actualizá el estado, la prioridad, el referido y
                            las etiquetas de este lead.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor='classify-status'>
                                Estado
                            </FieldLabel>
                            <Select
                                value={
                                    statuses.find(
                                        (s) =>
                                            s.id === Number(classifyStatusId)
                                    )?.name || ''
                                }
                                onValueChange={(val) =>
                                    setClassifyStatusId(val ?? '1')
                                }>
                                <SelectTrigger id='classify-status'>
                                    <SelectValue placeholder='Seleccionar...' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {statuses.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={String(s.id)}>
                                                <ColorDot color={s.color} />
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor='classify-priority'>
                                Prioridad
                            </FieldLabel>
                            <Select
                                value={
                                    priorities.find(
                                        (p) =>
                                            p.id === Number(classifyPriorityId)
                                    )?.name.toString() || ''
                                }
                                onValueChange={(val) =>
                                    setClassifyPriorityId(val ?? '1')
                                }>
                                <SelectTrigger id='classify-priority'>
                                    <SelectValue placeholder='Seleccionar...' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {priorities.map((p) => (
                                            <SelectItem
                                                key={p.id}
                                                value={String(p.id)}>
                                                <ColorDot color={p.color} />
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        {isAdmin && (
                            <>
                                <Field>
                                    <FieldLabel htmlFor='classify-referral'>
                                        Referido
                                    </FieldLabel>
                                    <Select
                                        value={
                                            referralOptions.find(
                                                (r) =>
                                                    r.id ===
                                                    Number(classifyReferralId)
                                            )?.name || ''
                                        }
                                        onValueChange={(val) =>
                                            setClassifyReferralId(val ?? '')
                                        }>
                                        <SelectTrigger id='classify-referral'>
                                            <SelectValue placeholder='Seleccionar...' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value=''>
                                                    Ninguno
                                                </SelectItem>
                                                {referralOptions.map((r) => (
                                                    <SelectItem
                                                        key={r.id}
                                                        value={String(r.id)}>
                                                        {r.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor='classify-assigned'>
                                        Asignado a
                                    </FieldLabel>
                                    <Select
                                        value={
                                            users.find(
                                                (u) =>
                                                    u.id === classifyAssignedTo
                                            )?.name || ''
                                        }
                                        onValueChange={(val) =>
                                            setClassifyAssignedTo(val ?? '')
                                        }>
                                        <SelectTrigger id='classify-assigned'>
                                            <SelectValue placeholder='Seleccionar...' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {users.map((u) => (
                                                    <SelectItem
                                                        key={u.id}
                                                        value={u.id}>
                                                        {u.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
</SelectContent>
                                        </Select>
                                    </Field>
                                </>
                            )}
                            <Field>
                                <FieldLabel>Etiquetas</FieldLabel>
                                <TagSelect
                                    options={tagOptions}
                                    selected={classifyTagIds}
                                    onToggle={toggleClassifyTag}
                                />
                            </Field>
                        </FieldGroup>
                        <div className='flex justify-end gap-2 pt-2'>
                            <Button
                                type='button'
                                variant='ghost'
                                onClick={() => setClassifyModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => classifyMutation.mutate()}
                                disabled={classifyMutation.isPending}>
                                {classifyMutation.isPending ? (
                                    <Loader2
                                        size={16}
                                        className='animate-spin'
                                    />
                                ) : (
                                    'Guardar cambios'
                                )}
                            </Button>
                        </div>
                </DialogContent>
            </Dialog>

            <CreateEventDialog
                customerId={eventCustomerId ?? 0}
                open={eventCustomerId !== null}
                onOpenChange={(open) => {
                    if (!open) setEventCustomerId(null)
                }}
            />
        </div>
    )
}
