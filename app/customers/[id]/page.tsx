'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    Loader2,
    MessageCircle,
    Pencil,
    Trash2,
    UserRound
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    SelectItem,
    SelectGroup,
    SelectContent,
    Select,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { TagPill, TagSelect, type TagOption } from '@/components/tags'
import { CustomerNotesTasks } from '@/components/customer/notes-tasks'
import { EventCard } from '@/components/events/events-card'
import { QuotationCard } from '@/components/cotizaciones/card'
import { useSession } from '@/hooks/use-session'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { COUNTRY_OPTIONS } from '@/lib/countries'

interface CustomerDetail {
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

const travelTimeLabels: Record<string, string> = {
    '0-3': 'Lo antes posible',
    '3-6': 'En 3-6 meses',
    '6-12': 'En 6-12 meses',
    '12-18': 'En 12-18 meses',
    '0': 'Solo explorando'
}

const customerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(1, 'Phone is required'),
    travelTime: z.string().min(1, 'Travel time is required'),
    country: z.string().optional(),
    statusId: z.string().min(1),
    priorityId: z.string().min(1),
    assignedTo: z.string().optional(),
    referralId: z.string().optional()
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
    country: 'Country',
    statusId: 'Status',
    priorityId: 'Priority',
    assignedTo: 'Assigned To',
    referralId: 'Referral',
    referralCode: 'Referral Code',
    tags: 'Tags'
}

function resolveValue(
    key: string,
    value: string | number | null | undefined,
    statuses: SelectOption[],
    priorities: SelectOption[],
    users: SelectOption[]
): string {
    if (value === null || value === undefined || value === '') return 'None'
    if (key === 'statusId') {
        return statuses.find((s) => s.id === value)?.name || String(value)
    }
    if (key === 'priorityId') {
        return priorities.find((p) => p.id === value)?.name || String(value)
    }
    if (key === 'assignedTo') {
        return users.find((u) => u.id === value)?.name || String(value)
    }
    if (key === 'referralId') {
        return value ? `#${value}` : 'None'
    }
    if (key === 'travelTime' || key === 'travel_time') {
        return travelTimeLabels[String(value)] || String(value)
    }
    return String(value)
}

function formatChanges(
    changes: string,
    statuses: SelectOption[],
    priorities: SelectOption[],
    users: SelectOption[]
) {
    const data = JSON.parse(changes) as Record<
        string,
        | {
              from: string | number | null | undefined
              to: string | number | null | undefined
          }
        | string
        | number
        | null
        | undefined
    >
    return Object.entries(data).map(([key, rawValue]) => {
        const label = FIELD_LABELS[key] || key

        const isChangeFormat =
            rawValue !== null &&
            typeof rawValue === 'object' &&
            'from' in rawValue &&
            'to' in rawValue

        if (isChangeFormat) {
            const changeValue = rawValue as {
                from: string | number | null | undefined
                to: string | number | null | undefined
            }
            const { from, to } = changeValue
            const fromDisplay = resolveValue(
                key,
                from,
                statuses,
                priorities,
                users
            )
            const toDisplay = resolveValue(key, to, statuses, priorities, users)
            return { label, value: `${fromDisplay} → ${toDisplay}` }
        }

        return {
            label,
            value: resolveValue(key, rawValue, statuses, priorities, users)
        }
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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

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

    const { data: customer, isLoading } = useQuery<CustomerDetail>({
        queryKey: ['customer', id],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${id}`)
            if (!res.ok) {
                if (res.status === 404) {
                    toast.error('Customer not found')
                    router.push('/leads')
                }
                throw new Error('Failed to fetch')
            }
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery({
        queryKey: ['statuses'],
        queryFn: () => fetch('/api/status').then((r) => r.json()),
        select: (data: Array<{ id: number; status: string; color: string }>) =>
            data.map((s) => ({ id: s.id, name: s.status }))
    }) as { data: SelectOption[] | undefined }

    const { data: priorities = [] } = useQuery({
        queryKey: ['priorities'],
        queryFn: () => fetch('/api/priority').then((r) => r.json()),
        select: (
            data: Array<{ id: number; priority: string; color: string }>
        ) => data.map((p) => ({ id: p.id, name: p.priority }))
    }) as { data: SelectOption[] | undefined }

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then((r) => r.json()),
        select: (
            data: Array<{ id: string; name: string | null; email: string }>
        ) =>
            data.map((u) => ({
                id: u.id,
                name: u.name || u.email
            })),
        enabled: isAdmin
    }) as { data: SelectOption[] | undefined }

    const { data: referralOptions = [] } = useQuery({
        queryKey: ['referrals'],
        queryFn: () => fetch('/api/referrals').then((r) => r.json()),
        select: (data: Array<{ id: number; code: string }>) =>
            data.map((r) => ({
                id: r.id,
                name: r.code
            })),
        enabled: isAdmin
    }) as { data: SelectOption[] | undefined }

    const { data: tagOptions = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: () => fetch('/api/tags').then((r) => r.json()),
        select: (
            data: Array<{
                id: number
                tag: string
                color: string
                isActive: number
            }>
        ) =>
            data
                .filter((t) => t.isActive)
                .map((t) => ({
                    id: t.id,
                    name: t.tag,
                    color: t.color || '#6b7280',
                    isActive: t.isActive
                }))
    }) as { data: TagOption[] | undefined }

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
                    priorityId: Number(data.priorityId),
                    referralId: data.referralId
                        ? Number(data.referralId)
                        : null,
                    tagIds: selectedTagIds
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
            queryClient.invalidateQueries({ queryKey: ['logs', id] })
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
            router.push('/leads')
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
        } else {
            router.push('/leads')
        }
    }

    const openEdit = () => {
        if (!customer) return
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

    const onSubmit = (data: CustomerFormValues) => updateMutation.mutate(data)

    const handleDelete = () => {
        if (deleteConfirmText !== 'confirm') return
        deleteMutation.mutate()
        setDeleteDialogOpen(false)
        setDeleteConfirmText('')
    }

    if (isLoading) {
        return <GlobeLoader fullScreen={false} className='py-32' />
    }

    if (!customer) return null

    return (
        <div className='container mx-auto p-6'>
            <div className='mb-6 flex items-center gap-4'>
                <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Go back'
                    onClick={handleBack}>
                    <ArrowLeft size={16} />
                </Button>
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
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
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
                            <button
                                type='button'
                                title='Copiar email'
                                className='cursor-pointer text-left text-sm hover:underline'
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
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Phone
                            </p>
                            <div className='flex items-center gap-2'>
                                <button
                                    type='button'
                                    title='Copiar teléfono'
                                    className='cursor-pointer text-left text-sm hover:underline'
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
                                <a
                                    href={`https://web.whatsapp.com/send/?phone=${customer.phone.replace(/\D/g, '')}&text&type=phone_number&app_absent=0`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700 transition-colors'>
                                    <MessageCircle size={12} />
                                    WhatsApp
                                </a>
                            </div>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Travel Time
                            </p>
                            <p className='text-sm'>
                                {travelTimeLabels[customer.travelTime] ||
                                    customer.travelTime}
                            </p>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Country
                            </p>
                            <p className='text-sm'>
                                {customer.country || 'No especificado'}
                            </p>
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
                                    color={customer.statusColor || '#6b7280'}
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
                                    color={customer.priorityColor || '#6b7280'}
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

                <Card>
                    <CardHeader>
                        <CardTitle>Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='flex flex-wrap gap-1.5'>
                            {customer.tags.filter((t) => t.isActive).length >
                            0 ? (
                                customer.tags
                                    .filter((t) => t.isActive)
                                    .map((t) => <TagPill key={t.id} tag={t} />)
                            ) : (
                                <span className='text-sm text-muted-foreground'>
                                    None
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
                <div className='md:col-span-2 mt-6'>
                    <QuotationCard customerId={customer.id} />
                </div>
                <div className='md:col-span-2'>
                    <CustomerNotesTasks customerId={customer.id} />
                </div>
                <div className='md:col-span-2'>
                    <EventCard customerId={customer.id} />
                </div>
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
                                                    ).map(
                                                        ({ label, value }) => (
                                                            <span key={label}>
                                                                <span className='font-medium text-foreground'>
                                                                    {label}:
                                                                </span>{' '}
                                                                <span className='text-muted-foreground'>
                                                                    {value}
                                                                </span>
                                                            </span>
                                                        )
                                                    )}
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

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className='max-h-[90vh] sm:max-w-lg overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>Edit Customer</DialogTitle>
                        <DialogDescription>
                            Update customer information.
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
                                        <FieldLabel htmlFor='edit-name'>
                                            Name
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-name'
                                            placeholder='Full name'
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
                                        <FieldLabel htmlFor='edit-email'>
                                            Email
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-email'
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
                                        <FieldLabel htmlFor='edit-phone'>
                                            Phone
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-phone'
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
                                        <FieldLabel htmlFor='edit-travelTime'>
                                            Travel Time
                                        </FieldLabel>
                                        <Select
                                            value={
                                                travelTimeLabels[field.value] ||
                                                field.value
                                            }
                                            onValueChange={field.onChange}>
                                            <SelectTrigger
                                                id='edit-travelTime'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }>
                                                <SelectValue placeholder='Select...' />
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
                                        <FieldLabel htmlFor='edit-country'>
                                            Country
                                        </FieldLabel>
                                        <Select
                                            value={field.value || ''}
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='edit-country'>
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
                                        <FieldLabel htmlFor='edit-statusId'>
                                            Status
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
                                            <SelectTrigger id='edit-statusId'>
                                                <SelectValue placeholder='Select...' />
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
                                        <FieldLabel htmlFor='edit-priorityId'>
                                            Priority
                                        </FieldLabel>
                                        <Select
                                            value={
                                                priorities.find(
                                                    (p) =>
                                                        p.id ===
                                                        Number(field.value)
                                                )?.name || ''
                                            }
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='edit-priorityId'>
                                                <SelectValue placeholder='Select...' />
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
                                            <FieldLabel htmlFor='edit-assignedTo'>
                                                Assigned To
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    users.find(
                                                        (u) =>
                                                            u.id === field.value
                                                    )?.name || ''
                                                }
                                                onValueChange={field.onChange}>
                                                <SelectTrigger id='edit-assignedTo'>
                                                    <SelectValue placeholder='Select...' />
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
                            {isAdmin && (
                                <Controller
                                    name='referralId'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='edit-referralId'>
                                                Referral Code
                                            </FieldLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}>
                                                <SelectTrigger id='edit-referralId'>
                                                    <SelectValue placeholder='Select...' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            None
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
                                <FieldLabel>Tags</FieldLabel>
                                <TagSelect
                                    options={tagOptions}
                                    selected={selectedTagIds}
                                    onToggle={(id) =>
                                        setSelectedTagIds((prev) =>
                                            prev.includes(id)
                                                ? prev.filter((i) => i !== id)
                                                : [...prev, id]
                                        )
                                    }
                                />
                            </Field>
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
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle className='text-destructive'>
                            Delete Customer
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently
                            delete <strong>{customer?.name}</strong> and all
                            associated data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='mb-4'>
                        <label className='mb-1 block text-sm font-medium'>
                            Type{' '}
                            <span className='font-mono font-bold text-destructive'>
                                confirm
                            </span>{' '}
                            to proceed
                        </label>
                        <Input
                            value={deleteConfirmText}
                            onChange={(e) =>
                                setDeleteConfirmText(e.target.value)
                            }
                            placeholder='confirm'
                            className='h-9'
                        />
                    </div>
                    <div className='flex justify-end gap-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            className='cursor-pointer'
                            onClick={() => {
                                setDeleteDialogOpen(false)
                                setDeleteConfirmText('')
                            }}>
                            Cancel
                        </Button>
                        <Button
                            variant='destructive'
                            disabled={
                                deleteConfirmText !== 'confirm' ||
                                deleteMutation.isPending
                            }
                            onClick={handleDelete}>
                            {deleteMutation.isPending ? (
                                <Loader2 size={16} className='animate-spin' />
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
