'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Loader2,
    Pencil,
    Plus,
    Search,
    UserPlus,
    X
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    SelectItem,
    SelectList,
    SelectPopup,
    SelectRoot,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { useSession } from '@/hooks/use-session'

interface CustomerRow {
    id: number
    name: string
    phone: string
    email: string
    travelTime: string
    statusId: number
    priorityId: number
    assignedTo: string
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

const customerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(1, 'Phone is required'),
    travelTime: z.string().min(1, 'Travel time is required'),
    statusId: z.string().min(1),
    priorityId: z.string().min(1),
    assignedTo: z.string().optional()
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
    const queryClient = useQueryClient()
    const { session, isPending: sessionLoading } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [search, setSearch] = useState('')
    const [filterStatusId, setFilterStatusId] = useState('')
    const [filterPriorityId, setFilterPriorityId] = useState('')
    const [filterAssignedTo, setFilterAssignedTo] = useState('')
    const initialFilterRef = useRef(false)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )

    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const [bulkStatusId, setBulkStatusId] = useState('')
    const [bulkPriorityId, setBulkPriorityId] = useState('')
    const [bulkAssignedTo, setBulkAssignedTo] = useState('')

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            travelTime: '',
            statusId: '1',
            priorityId: '1',
            assignedTo: ''
        }
    })

    const queryKey = [
        'customers',
        search,
        filterStatusId,
        filterPriorityId,
        filterAssignedTo,
        page,
        pageSize
    ] as const

    const { data: customersData, isLoading } = useQuery<CustomersResponse>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (filterStatusId)
                params.set('statusId', filterStatusId)
            if (filterPriorityId)
                params.set('priorityId', filterPriorityId)
            if (filterAssignedTo)
                params.set('assignedTo', filterAssignedTo)
            params.set('page', String(page))
            params.set('pageSize', String(pageSize))

            const res = await fetch(`/api/customers?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery<LabelOption[]>({
        queryKey: ['statuses'],
        queryFn: () => fetch('/api/status').then(r => r.json()),
        select: (data: any[]) =>
            data.map((s: any) => ({
                id: s.id,
                name: s.status,
                color: s.color || '#6b7280'
            }))
    })

    const { data: priorities = [] } = useQuery<LabelOption[]>({
        queryKey: ['priorities'],
        queryFn: () => fetch('/api/priority').then(r => r.json()),
        select: (data: any[]) =>
            data.map((p: any) => ({
                id: p.id,
                name: p.priority,
                color: p.color || '#6b7280'
            }))
    })

    const { data: users = [] } = useQuery<
        { id: string; name: string }[]
    >({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then(r => r.json()),
        select: (data: any[]) =>
            data.map((u: any) => ({
                id: u.id,
                name: u.name || u.email
            })),
        enabled: isAdmin
    })

    useEffect(() => {
        if (!initialFilterRef.current && session?.user.id) {
            setFilterAssignedTo(session.user.id)
            initialFilterRef.current = true
        }
    }, [session?.user.id])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setPage(1), 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [search, filterStatusId, filterPriorityId, filterAssignedTo])

    useEffect(() => {
        if (selectedIds.length === 0) {
            setBulkStatusId('')
            setBulkPriorityId('')
            setBulkAssignedTo('')
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
        }: Record<string, any>) => {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update')
            }
            return res.json()
        },
        onSuccess: () => invalidate(),
        onError: (error: Error) => toast.error(error.message)
    })

    const bulkMutation = useMutation({
        mutationFn: async (data: {
            ids: number[]
            statusId?: number
            priorityId?: number
            assignedTo?: string
        }) => {
            const res = await fetch('/api/customers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to bulk update')
            }
            return res.json()
        },
        onSuccess: (res: any) => {
            toast.success(`${res.updated} customers updated`)
            setSelectedIds([])
            setBulkStatusId('')
            setBulkPriorityId('')
            setBulkAssignedTo('')
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
                ...data,
                statusId: Number(data.statusId),
                priorityId: Number(data.priorityId)
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to save')
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
            statusId: '1',
            priorityId: '1',
            assignedTo: session?.user.id || ''
        })
        setModalOpen(true)
    }

    const openEdit = (customer: CustomerRow) => {
        setEditingId(customer.id)
        form.reset({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            travelTime: customer.travelTime,
            statusId: String(customer.statusId),
            priorityId: String(customer.priorityId),
            assignedTo: customer.assignedTo || ''
        })
        setModalOpen(true)
    }

    const onSubmit = (data: CustomerFormValues) => saveMutation.mutate(data)

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === customers.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(customers.map(c => c.id))
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
        return (
            <div className='flex items-center justify-center py-32'>
                <Loader2
                    size={24}
                    className='animate-spin text-muted-foreground'
                />
            </div>
        )
    }

    if (!session) {
        return (
            <div className='flex flex-col items-center justify-center py-32 text-center'>
                <UserPlus
                    size={48}
                    className='mb-4 text-muted-foreground'
                />
                <h2 className='mb-2 text-xl font-medium'>
                    Welcome to AIR CRM
                </h2>
                <p className='mb-6 text-muted-foreground'>
                    Sign in to manage your customers
                </p>
                <Link href='/signin'>
                    <Button>Sign In</Button>
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
                            <CardTitle>Customers</CardTitle>
                            <p className='mt-0.5 text-sm text-muted-foreground'>
                                {total} customer
                                {total !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <Button onClick={openCreate} size='sm'>
                            <Plus /> New Customer
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='mb-4 flex flex-wrap items-center gap-2'>
                        <div className='relative min-w-[200px] flex-1'>
                            <Search
                                size={16}
                                className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                            />
                            <input
                                type='text'
                                placeholder='Search by name, email, or phone...'
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className='h-8 w-full rounded-lg border border-input bg-transparent py-1 pl-8 pr-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground'
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <select
                            value={filterStatusId}
                            onChange={e => {
                                setFilterStatusId(e.target.value)
                                setPage(1)
                            }}
                            className='h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'>
                            <option value=''>All Statuses</option>
                            {statuses.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filterPriorityId}
                            onChange={e => {
                                setFilterPriorityId(e.target.value)
                                setPage(1)
                            }}
                            className='h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'>
                            <option value=''>All Priorities</option>
                            {priorities.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        {isAdmin && (
                            <select
                                value={filterAssignedTo}
                                onChange={e => {
                                    setFilterAssignedTo(e.target.value)
                                    setPage(1)
                                }}
                                className='h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'>
                                <option value=''>All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedIds.length > 0 && (
                        <div className='mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2'>
                            <span className='text-sm font-medium'>
                                {selectedIds.length} selected
                            </span>
                            <span className='text-muted-foreground'>|</span>
                            <label className='text-sm text-muted-foreground'>
                                Status:
                            </label>
                            <select
                                value={bulkStatusId}
                                onChange={e =>
                                    setBulkStatusId(e.target.value)
                                }
                                className='h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3'>
                                <option value=''>No change</option>
                                {statuses.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            <label className='text-sm text-muted-foreground'>
                                Priority:
                            </label>
                            <select
                                value={bulkPriorityId}
                                onChange={e =>
                                    setBulkPriorityId(e.target.value)
                                }
                                className='h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3'>
                                <option value=''>No change</option>
                                {priorities.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            {isAdmin && (
                                <>
                                    <label className='text-sm text-muted-foreground'>
                                        Assign to:
                                    </label>
                                    <select
                                        value={bulkAssignedTo}
                                        onChange={e =>
                                            setBulkAssignedTo(
                                                e.target.value
                                            )
                                        }
                                        className='h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3'>
                                        <option value=''>No change</option>
                                        {users.map(u => (
                                            <option
                                                key={u.id}
                                                value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                            <Button
                                size='xs'
                                onClick={() => {
                                    if (
                                        !bulkStatusId &&
                                        !bulkPriorityId &&
                                        !bulkAssignedTo
                                    ) {
                                        toast.error(
                                            'Select at least one change'
                                        )
                                        return
                                    }
                                    bulkMutation.mutate({
                                        ids: selectedIds,
                                        ...(bulkStatusId && {
                                            statusId: Number(
                                                bulkStatusId
                                            )
                                        }),
                                        ...(bulkPriorityId && {
                                            priorityId: Number(
                                                bulkPriorityId
                                            )
                                        }),
                                        ...(bulkAssignedTo && {
                                            assignedTo:
                                                bulkAssignedTo
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
                                    'Save'
                                )}
                            </Button>
                            <span className='text-muted-foreground'>|</span>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => {
                                    const selected = customers.filter(
                                        c =>
                                            selectedIds.includes(c.id)
                                    )
                                    const headers = [
                                        'Name',
                                        'Email',
                                        'Phone',
                                        'Travel Time',
                                        'Status',
                                        'Priority',
                                        'Assigned To'
                                    ]
                                    const csv =
                                        '\uFEFF' +
                                        [
                                            headers.join(','),
                                            ...selected.map(c =>
                                                [
                                                    c.name,
                                                    c.email,
                                                    c.phone,
                                                    c.travelTime,
                                                    c.statusName || '',
                                                    c.priorityName || '',
                                                    c.assignedUserName ||
                                                        ''
                                                ]
                                                    .map(f =>
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
                                    const url =
                                        URL.createObjectURL(blob)
                                    const a =
                                        document.createElement('a')
                                    a.href = url
                                    a.download = 'contacts.csv'
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}>
                                Export CSV
                            </Button>
                            <Button
                                size='xs'
                                variant='outline'
                                onClick={() => {
                                    const selected = customers.filter(
                                        c =>
                                            selectedIds.includes(c.id)
                                    )
                                    const rows = selected.map(c => {
                                        const firstName =
                                            c.name.split(' ')[0]
                                        const phone =
                                            c.phone.replace(/\s/g, '')
                                        return `${firstName},${phone}`
                                    })
                                    const csv =
                                        '\uFEFF' +
                                        [
                                            'First Name,Phone',
                                            ...rows
                                        ].join('\n')
                                    const blob = new Blob([csv], {
                                        type: 'text/csv;charset=utf-8;'
                                    })
                                    const url =
                                        URL.createObjectURL(blob)
                                    const a =
                                        document.createElement('a')
                                    a.href = url
                                    a.download = 'wa-sender.csv'
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}>
                                WA Sender
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
                                }}>
                                Clear
                            </Button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className='flex items-center justify-center py-16'>
                            <Loader2
                                size={20}
                                className='animate-spin text-muted-foreground'
                            />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className='py-16 text-center'>
                            <p className='text-muted-foreground'>
                                {search || filterStatusId || filterPriorityId
                                    ? 'No customers match your filters'
                                    : 'No customers yet. Create your first one!'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className='overflow-x-auto'>
                                <table className='w-full text-sm'>
                                    <thead>
                                        <tr className='border-b text-left text-muted-foreground'>
                                            <th className='w-8 pb-2'>
                                                <input
                                                    type='checkbox'
                                                    checked={
                                                        selectedIds.length ===
                                                            customers.length &&
                                                        customers.length > 0
                                                    }
                                                    onChange={
                                                        toggleSelectAll
                                                    }
                                                    className='h-4 w-4 rounded border-input'
                                                />
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Name
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Email
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Phone
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Travel Time
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Status
                                            </th>
                                            <th className='pb-2 font-medium'>
                                                Priority
                                            </th>
                                            {isAdmin && (
                                                <th className='pb-2 font-medium'>
                                                    Assigned To
                                                </th>
                                            )}
                                            <th className='pb-2 font-medium text-right'>
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customers.map(customer => {
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
                                                        <input
                                                            type='checkbox'
                                                            checked={selectedIds.includes(
                                                                customer.id
                                                            )}
                                                            onChange={() =>
                                                                toggleSelect(
                                                                    customer.id
                                                                )
                                                            }
                                                            className='h-4 w-4 rounded border-input'
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
                                                        {customer.email}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        {customer.phone}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        {customer.travelTime}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <SelectRoot
                                                            value={String(
                                                                customer.statusId
                                                            )}
                                                            onValueChange={(
                                                                val: any
                                                            ) =>
                                                                handleInlineUpdate(
                                                                    customer.id,
                                                                    'statusId',
                                                                    Number(
                                                                        val
                                                                    )
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
                                                            <SelectPopup>
                                                                <SelectList>
                                                                    {statuses.map(
                                                                        s => (
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
                                                                </SelectList>
                                                            </SelectPopup>
                                                        </SelectRoot>
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <SelectRoot
                                                            value={String(
                                                                customer.priorityId
                                                            )}
                                                            onValueChange={(
                                                                val: any
                                                            ) =>
                                                                handleInlineUpdate(
                                                                    customer.id,
                                                                    'priorityId',
                                                                    Number(
                                                                        val
                                                                    )
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
                                                            <SelectPopup>
                                                                <SelectList>
                                                                    {priorities.map(
                                                                        p => (
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
                                                                </SelectList>
                                                            </SelectPopup>
                                                        </SelectRoot>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className='py-2.5'>
                                                            <SelectRoot
                                                                value={
                                                                    customer.assignedTo
                                                                }
                                                                onValueChange={(val: any) =>
                                                                    handleInlineUpdate(
                                                                        customer.id,
                                                                        'assignedTo',
                                                                        val
                                                                    )
                                                                }>
                                                                <SelectTrigger className='h-7 max-w-[150px] text-xs'>
                                                                    <SelectValue>
                                                                        {customer.assignedUserName ||
                                                                            'Unassigned'}
                                                                    </SelectValue>
                                                                </SelectTrigger>
                                                                <SelectPopup>
                                                                    <SelectList>
                                                                        {users.map(
                                                                            u => (
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
                                                                    </SelectList>
                                                                </SelectPopup>
                                                            </SelectRoot>
                                                        </td>
                                                    )}
                                                    <td className='py-2.5 text-right'>
                                                        <div className='flex items-center justify-end gap-1'>
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
                                    <span>Rows per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={e => {
                                            setPageSize(
                                                Number(e.target.value)
                                            )
                                            setPage(1)
                                        }}
                                        className='h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring'>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span>
                                        {(page - 1) * pageSize + 1}–
                                        {Math.min(
                                            page * pageSize,
                                            total
                                        )}{' '}
                                        of {total}
                                    </span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <Button
                                        size='icon-sm'
                                        variant='outline'
                                        disabled={page <= 1}
                                        onClick={() =>
                                            setPage(p => p - 1)
                                        }>
                                        <ChevronLeft size={14} />
                                    </Button>
                                    {Array.from(
                                        {
                                            length: Math.min(
                                                totalPages,
                                                5
                                            )
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
                                            if (p > totalPages)
                                                return null
                                            return (
                                                <Button
                                                    key={p}
                                                    size='icon-sm'
                                                    variant={
                                                        p === page
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    onClick={() =>
                                                        setPage(p)
                                                    }>
                                                    {p}
                                                </Button>
                                            )
                                        }
                                    )}
                                    <Button
                                        size='icon-sm'
                                        variant='outline'
                                        disabled={page >= totalPages}
                                        onClick={() =>
                                            setPage(p => p + 1)
                                        }>
                                        <ChevronRight size={14} />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {modalOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                    <div className='mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                        <h2 className='mb-1 text-lg font-medium'>
                            {editingId ? 'Edit' : 'New'} Customer
                        </h2>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            {editingId
                                ? 'Update customer information.'
                                : 'Enter the details for the new customer.'}
                        </p>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className='grid gap-4'>
                            <FieldGroup>
                                <Controller
                                    name='name'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='name'>
                                                Name
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='name'
                                                placeholder='Full name'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
                                            />
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[
                                                        fieldState.error
                                                    ]}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='email'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='email'>
                                                Email
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='email'
                                                type='email'
                                                placeholder='customer@example.com'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
                                            />
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[
                                                        fieldState.error
                                                    ]}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='phone'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='phone'>
                                                Phone
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='phone'
                                                type='tel'
                                                placeholder='+1 (555) 000-0000'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
                                            />
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[
                                                        fieldState.error
                                                    ]}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='travelTime'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='travelTime'>
                                                Travel Time
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='travelTime'
                                                placeholder='e.g. 2 hours, 30 min'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
                                            />
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[
                                                        fieldState.error
                                                    ]}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='statusId'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='statusId'>
                                                Status
                                            </FieldLabel>
                                            <select
                                                {...field}
                                                id='statusId'
                                                className='h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3'>
                                                {statuses.map(s => (
                                                    <option
                                                        key={s.id}
                                                        value={s.id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='priorityId'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='priorityId'>
                                                Priority
                                            </FieldLabel>
                                            <select
                                                {...field}
                                                id='priorityId'
                                                className='h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3'>
                                                {priorities.map(p => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
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
                                                    Assigned To
                                                </FieldLabel>
                                                <select
                                                    {...field}
                                                    id='assignedTo'
                                                    className='h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3'>
                                                    {users.map(u => (
                                                        <option
                                                            key={u.id}
                                                            value={u.id}>
                                                            {u.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                        )}
                                    />
                                )}
                            </FieldGroup>
                            <div className='flex justify-end gap-2 pt-2'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setModalOpen(false)}>
                                    Cancel
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
                                        'Update Customer'
                                    ) : (
                                        'Create Customer'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
