'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { Copy, Check, Plus, Loader2, Link2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    SelectItem,
    SelectGroup,
    SelectContent,
    Select,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel
} from '@/components/ui/field'

interface Referral {
    id: number
    code: string
    name: string | null
}

interface Lead {
    id: number
    name: string
    email: string
    phone: string
    createdAt: string | null
    statusName: string | null
    statusColor: string | null
    priorityName: string | null
    priorityColor: string | null
}

const leadSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(1, 'Phone is required'),
    travelTime: z.string().optional()
})

type LeadForm = z.infer<typeof leadSchema>

export default function RefDashboard() {
    const queryClient = useQueryClient()
    const [copied, setCopied] = useState(false)
    const [showCreate, setShowCreate] = useState(false)

    const form = useForm<LeadForm>({
        resolver: zodResolver(leadSchema),
        defaultValues: { name: '', email: '', phone: '', travelTime: '' }
    })

    const { data: referral } = useQuery<Referral>({
        queryKey: ['ref-referral'],
        queryFn: async () => {
            const res = await fetch('/api/ref/referral')
            if (!res.ok) throw new Error('Failed to fetch referral')
            return res.json()
        }
    })

    const { data: leads = [], isLoading } = useQuery<Lead[]>({
        queryKey: ['ref-leads'],
        queryFn: async () => {
            const res = await fetch('/api/ref/leads')
            if (!res.ok) throw new Error('Failed to fetch leads')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async (data: LeadForm) => {
            const res = await fetch('/api/ref/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create lead')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Lead created successfully')
            setShowCreate(false)
            form.reset()
            queryClient.invalidateQueries({ queryKey: ['ref-leads'] })
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const referralLink = referral
        ? `https://airtravel.es/?ref=${referral.code}`
        : ''

    const handleCopy = async () => {
        if (!referralLink) return
        await navigator.clipboard.writeText(referralLink)
        setCopied(true)
        toast.success('Referral link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className='container mx-auto p-6 space-y-6'>
            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-medium'>Referral Dashboard</h1>
                <Button
                    onClick={() => {
                        form.reset()
                        setShowCreate(true)
                    }}
                    size='sm'>
                    <Plus /> New Lead
                </Button>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2 text-base'>
                            <Link2 size={16} />
                            Your Referral Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {referral ? (
                            <div className='space-y-3'>
                                <div className='flex items-center gap-2'>
                                    <Input
                                        value={referralLink}
                                        readOnly
                                        className='font-mono text-sm'
                                    />
                                    <Button
                                        size='icon'
                                        variant='outline'
                                        onClick={handleCopy}
                                        className='shrink-0'>
                                        {copied ? (
                                            <Check size={14} />
                                        ) : (
                                            <Copy size={14} />
                                        )}
                                    </Button>
                                </div>
                                <p className='text-xs text-muted-foreground'>
                                    Code:{' '}
                                    <span className='font-mono font-medium text-foreground'>
                                        {referral.code}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <p className='text-sm text-muted-foreground'>
                                No referral code assigned yet.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2 text-base'>
                            <Users size={16} />
                            Leads Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <p className='text-2xl font-medium'>
                                    {leads.length}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                    Total Leads
                                </p>
                            </div>
                            <div>
                                <p className='text-2xl font-medium'>
                                    {
                                        leads.filter(
                                            (l) =>
                                                l.statusName?.toLowerCase() ===
                                                    'new' ||
                                                l.statusName?.toLowerCase() ===
                                                    'nuevo'
                                        ).length
                                    }
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                    New Leads
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className='text-base'>Your Leads</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className='flex items-center justify-center py-8'>
                            <Loader2
                                size={20}
                                className='animate-spin text-muted-foreground'
                            />
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm'>
                                <thead>
                                    <tr className='border-b text-left text-muted-foreground'>
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
                                            Status
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Registered
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className='py-8 text-center text-muted-foreground'>
                                                No leads yet. Create your first
                                                lead!
                                            </td>
                                        </tr>
                                    )}
                                    {leads.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            className='border-b last:border-0'>
                                            <td className='py-2.5 font-medium'>
                                                {lead.name}
                                            </td>
                                            <td className='py-2.5 text-muted-foreground'>
                                                {lead.email}
                                            </td>
                                            <td className='py-2.5 text-muted-foreground'>
                                                {lead.phone}
                                            </td>
                                            <td className='py-2.5'>
                                                <span
                                                    className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
                                                    style={{
                                                        backgroundColor: `${lead.statusColor || '#6b7280'}20`,
                                                        color:
                                                            lead.statusColor ||
                                                            '#6b7280'
                                                    }}>
                                                    {lead.statusName ||
                                                        'Unknown'}
                                                </span>
                                            </td>
                                            <td className='py-2.5 text-muted-foreground'>
                                                {lead.createdAt
                                                    ? new Date(
                                                          lead.createdAt
                                                      ).toLocaleString('es', {
                                                          dateStyle: 'short',
                                                          timeStyle: 'short'
                                                      })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {showCreate && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                    <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                        <h2 className='mb-1 text-lg font-medium'>
                            Create Lead
                        </h2>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            Add a new lead. Your referral code will be
                            automatically assigned.
                        </p>
                        <form
                            onSubmit={form.handleSubmit((data) =>
                                createMutation.mutate(data)
                            )}
                            className='grid gap-4'>
                            <FieldGroup>
                                <Controller
                                    name='name'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel>Name</FieldLabel>
                                            <Input
                                                {...field}
                                                placeholder='Full name'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
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
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel>Email</FieldLabel>
                                            <Input
                                                {...field}
                                                type='email'
                                                placeholder='email@example.com'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
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
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel>Phone</FieldLabel>
                                            <Input
                                                {...field}
                                                placeholder='Phone number'
                                                aria-invalid={
                                                    fieldState.invalid
                                                }
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
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Travel Time</FieldLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}>
                                                <SelectTrigger>
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
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <div className='flex justify-end gap-2'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    className='cursor-pointer'
                                    onClick={() => setShowCreate(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type='submit'
                                    disabled={createMutation.isPending}>
                                    {createMutation.isPending ? (
                                        <Loader2
                                            size={16}
                                            className='animate-spin'
                                        />
                                    ) : (
                                        'Create Lead'
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
