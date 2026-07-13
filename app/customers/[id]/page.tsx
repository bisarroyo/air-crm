'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    Loader2,
    Pencil,
    Trash2,
    UserRound
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { useSession } from '@/hooks/use-session'

interface CustomerDetail {
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

interface SelectOption {
    id: number | string
    name: string
}

interface LogEntry {
    id: number
    action: string
    changes: string | null
    createdAt: string | null
    userName: string | null
    userEmail: string | null
    referralCode: string | null
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

function formatAction(action: string) {
    const map: Record<string, string> = {
        created: 'Created',
        updated: 'Updated',
        lead_created: 'Lead Received',
        lead_updated: 'Lead Re-submitted',
        bulk_updated: 'Bulk Updated'
    }
    return map[action] || action
}

const FIELD_LABELS: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    travelTime: 'Travel Time',
    travel_time: 'Travel Time',
    statusId: 'Status',
    priorityId: 'Priority',
    assignedTo: 'Assigned To',
    referralId: 'Referral',
    referralCode: 'Referral Code'
}

function formatChanges(
    changes: string,
    statuses: SelectOption[],
    priorities: SelectOption[],
    users: SelectOption[]
) {
    const data = JSON.parse(changes)
    return Object.entries(data).map(([key, value]) => {
        const label = FIELD_LABELS[key] || key

        let displayValue: string
        if (key === 'statusId') {
            displayValue =
                statuses.find(s => s.id === value)?.name ||
                String(value)
        } else if (key === 'priorityId') {
            displayValue =
                priorities.find(p => p.id === value)?.name ||
                String(value)
        } else if (key === 'assignedTo') {
            displayValue =
                users.find(u => u.id === value)?.name ||
                String(value)
        } else if (key === 'referralId') {
            displayValue = value ? `#${value}` : 'None'
        } else if (value === null || value === undefined) {
            displayValue = 'None'
        } else {
            displayValue = String(value)
        }

        return { label, value: displayValue }
    })
}

function ColorDot({ color }: { color: string }) {
    return (
        <span
            className='inline-block h-3 w-3 shrink-0 rounded-full'
            style={{ backgroundColor: color || '#6b7280' }}
        />
    )
}

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [modalOpen, setModalOpen] = useState(false)

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

    const { data: customer, isLoading } = useQuery<CustomerDetail>({
        queryKey: ['customer', id],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${id}`)
            if (!res.ok) {
                if (res.status === 404) {
                    toast.error('Customer not found')
                    router.push('/')
                }
                throw new Error('Failed to fetch')
            }
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery<SelectOption[]>({
        queryKey: ['statuses'],
        queryFn: () => fetch('/api/status').then(r => r.json()),
        select: (data: any[]) =>
            data.map(s => ({ id: s.id, name: s.status }))
    })

    const { data: priorities = [] } = useQuery<SelectOption[]>({
        queryKey: ['priorities'],
        queryFn: () => fetch('/api/priority').then(r => r.json()),
        select: (data: any[]) =>
            data.map(p => ({ id: p.id, name: p.priority }))
    })

    const { data: users = [] } = useQuery<SelectOption[]>({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then(r => r.json()),
        select: (data: any[]) =>
            data.map((u: any) => ({
                id: u.id,
                name: u.name || u.email
            })),
        enabled: isAdmin
    })

    const { data: logs = [] } = useQuery<LogEntry[]>({
        queryKey: ['logs', id],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${id}/logs`)
            if (!res.ok) throw new Error('Failed to fetch logs')
            return res.json()
        }
    })

    const updateMutation = useMutation({
        mutationFn: async (data: CustomerFormValues) => {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    statusId: Number(data.statusId),
                    priorityId: Number(data.priorityId)
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Customer updated successfully')
            setModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['customer', id] })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/customers/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Customer deleted')
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push('/')
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openEdit = () => {
        if (!customer) return
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

    const onSubmit = (data: CustomerFormValues) =>
        updateMutation.mutate(data)

    const handleDelete = () => {
        if (
            !confirm(
                'Are you sure you want to delete this customer? This action cannot be undone.'
            )
        )
            return
        deleteMutation.mutate()
    }

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-32'>
                <Loader2
                    size={24}
                    className='animate-spin text-muted-foreground'
                />
            </div>
        )
    }

    if (!customer) return null

    return (
        <div className='container mx-auto p-6'>
            <div className='mb-6 flex items-center gap-4'>
                <Link href='/'>
                    <Button variant='ghost' size='icon-sm'>
                        <ArrowLeft size={16} />
                    </Button>
                </Link>
                <div className='flex-1'>
                    <h1 className='text-xl font-medium'>{customer.name}</h1>
                    <p className='text-sm text-muted-foreground'>
                        Customer #{customer.id}
                    </p>
                </div>
                <div className='flex gap-2'>
                    <Button size='sm' onClick={openEdit}>
                        <Pencil size={14} /> Edit
                    </Button>
                    {isAdmin && (
                        <Button
                            size='sm'
                            variant='destructive'
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? (
                                <Loader2
                                    size={14}
                                    className='animate-spin'
                                />
                            ) : (
                                <Trash2 size={14} />
                            )}
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Email
                            </p>
                            <p className='text-sm'>{customer.email}</p>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Phone
                            </p>
                            <p className='text-sm'>{customer.phone}</p>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Travel Time
                            </p>
                            <p className='text-sm'>{customer.travelTime}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Classification</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Status
                            </p>
                            <div className='mt-1 flex items-center gap-2'>
                                <ColorDot
                                    color={
                                        customer.statusColor || '#6b7280'
                                    }
                                />
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        customer.statusIsActive
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                    {customer.statusName || 'Unknown'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Priority
                            </p>
                            <div className='mt-1 flex items-center gap-2'>
                                <ColorDot
                                    color={
                                        customer.priorityColor || '#6b7280'
                                    }
                                />
                                <span className='inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                                    {customer.priorityName || 'Unknown'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Assigned To
                            </p>
                            <div className='mt-1 flex items-center gap-2 text-sm'>
                                <UserRound
                                    size={14}
                                    className='text-muted-foreground'
                                />
                                {customer.assignedUserName ||
                                    customer.assignedUserEmail ||
                                    'Unassigned'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Created
                            </p>
                            <p className='text-sm'>
                                {customer.createdAt
                                    ? new Date(
                                          customer.createdAt
                                      ).toLocaleString('es', {
                                          dateStyle: 'long',
                                          timeStyle: 'short'
                                      })
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Last Updated
                            </p>
                            <p className='text-sm'>
                                {customer.updatedAt
                                    ? new Date(
                                          customer.updatedAt
                                      ).toLocaleString('es', {
                                          dateStyle: 'long',
                                          timeStyle: 'short'
                                      })
                                    : '—'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className='mt-6'>
                <Card>
                    <CardHeader>
                        <CardTitle>Activity History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {logs.length === 0 ? (
                            <p className='py-4 text-center text-sm text-muted-foreground'>
                                No activity recorded yet.
                            </p>
                        ) : (
                            <div className='space-y-0'>
                                {logs.map((log, i) => (
                                    <div
                                        key={log.id}
                                        className='relative flex gap-4 pb-6 last:pb-0'>
                                        {i < logs.length - 1 && (
                                            <div className='absolute left-[7px] top-3 h-full w-px bg-border' />
                                        )}
                                        <div className='flex shrink-0 items-start pt-0.5'>
                                            <div className='h-[15px] w-[15px] rounded-full border-2 border-primary bg-background' />
                                        </div>
                                        <div className='flex-1 space-y-1'>
                                            <div className='flex items-center gap-2 text-sm'>
                                                <span className='font-medium capitalize'>
                                                    {formatAction(log.action)}
                                                </span>
                                                {log.referralCode && (
                                                    <span className='rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary'>
                                                        {log.referralCode}
                                                    </span>
                                                )}
                                                <span className='text-xs text-muted-foreground'>
                                                    {log.createdAt
                                                        ? new Date(
                                                              log.createdAt
                                                          ).toLocaleString(
                                                              'es',
                                                              {
                                                                  dateStyle:
                                                                      'short',
                                                                  timeStyle:
                                                                      'short'
                                                              }
                                                          )
                                                        : ''}
                                                </span>
                                            </div>
                                            {log.changes && (
                                                <div className='flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/50 p-2 text-xs'>
                                                    {formatChanges(
                                                        log.changes,
                                                        statuses,
                                                        priorities,
                                                        users
                                                    ).map(({ label, value }) => (
                                                        <span key={label}>
                                                            <span className='font-medium text-foreground'>
                                                                {label}:
                                                            </span>{' '}
                                                            <span className='text-muted-foreground'>
                                                                {value}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <p className='text-xs text-muted-foreground'>
                                                {log.userName
                                                    ? `by ${log.userName}`
                                                    : 'by anonymous'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {modalOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                    <div className='mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                        <h2 className='mb-1 text-lg font-medium'>
                            Edit Customer
                        </h2>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            Update customer information.
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
                                            <FieldLabel htmlFor='edit-name'>
                                                Name
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='edit-name'
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
                                            <FieldLabel htmlFor='edit-email'>
                                                Email
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='edit-email'
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
                                            <FieldLabel htmlFor='edit-phone'>
                                                Phone
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='edit-phone'
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
                                            <FieldLabel htmlFor='edit-travelTime'>
                                                Travel Time
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='edit-travelTime'
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
                                            <FieldLabel htmlFor='edit-statusId'>
                                                Status
                                            </FieldLabel>
                                            <select
                                                {...field}
                                                id='edit-statusId'
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
                                            <FieldLabel htmlFor='edit-priorityId'>
                                                Priority
                                            </FieldLabel>
                                            <select
                                                {...field}
                                                id='edit-priorityId'
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
                                                <FieldLabel htmlFor='edit-assignedTo'>
                                                    Assigned To
                                                </FieldLabel>
                                                <select
                                                    {...field}
                                                    id='edit-assignedTo'
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
                                    disabled={updateMutation.isPending}>
                                    {updateMutation.isPending ? (
                                        <Loader2
                                            size={16}
                                            className='animate-spin'
                                        />
                                    ) : (
                                        'Update Customer'
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
