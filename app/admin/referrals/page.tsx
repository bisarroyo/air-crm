'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    SelectItem,
    SelectList,
    SelectPopup,
    SelectRoot,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'

interface User {
    id: string
    name: string
    email: string
}

interface Referral {
    id: number
    code: string
    userId: string
    name: string | null
    createdAt: string | null
    userName: string | null
    userEmail: string | null
}

const schema = z.object({
    code: z.string().min(1, 'Code is required'),
    userId: z.string().min(1, 'User is required'),
    name: z.string().optional()
})

type FormValues = z.infer<typeof schema>

export default function ReferralsPage() {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { code: '', userId: '', name: '' }
    })

    const { data: referrals = [], isLoading } = useQuery<Referral[]>({
        queryKey: ['referrals'],
        queryFn: async () => {
            const res = await fetch('/api/referrals')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        }
    })

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await fetch('/api/users')
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
        }
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['referrals'] })

    const saveMutation = useMutation({
        mutationFn: async (data: FormValues) => {
            const isEdit = editingId !== null
            const url = isEdit ? `/api/referrals/${editingId}` : '/api/referrals'
            const method = isEdit ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to save')
            }

            return res.json()
        },
        onSuccess: () => {
            toast.success(
                `Referral ${editingId ? 'updated' : 'created'} successfully`
            )
            setDialogOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async (referral: Referral) => {
            const res = await fetch(`/api/referrals/${referral.id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Referral deleted')
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openCreate = () => {
        setEditingId(null)
        form.reset({ code: '', userId: '', name: '' })
        setDialogOpen(true)
    }

    const openEdit = (referral: Referral) => {
        setEditingId(referral.id)
        form.reset({
            code: referral.code,
            userId: referral.userId,
            name: referral.name || ''
        })
        setDialogOpen(true)
    }

    const getSelectedUserName = (userId: string) => {
        const user = users.find(u => u.id === userId)
        return user ? `${user.name} (${user.email})` : 'Unknown user'
    }

    const onSubmit = (data: FormValues) => saveMutation.mutate(data)

    const handleDelete = (referral: Referral) => {
        if (
            !confirm(
                `Are you sure you want to delete referral code "${referral.code}"?`
            )
        )
            return
        deleteMutation.mutate(referral)
    }

    return (
        <div className='container mx-auto p-6'>
            <Card>
                <CardHeader>
                    <div className='flex items-center justify-between'>
                        <CardTitle>Manage Referral Codes</CardTitle>
                        <Button onClick={openCreate} size='sm'>
                            <Plus /> New Referral
                        </Button>
                    </div>
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
                                            ID
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Code
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Name
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Linked User
                                        </th>
                                        <th className='pb-2 font-medium text-right'>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {referrals.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className='py-8 text-center text-muted-foreground'>
                                                No referral codes found
                                            </td>
                                        </tr>
                                    )}
                                    {referrals.map(referral => (
                                        <tr
                                            key={referral.id}
                                            className='border-b last:border-0'>
                                            <td className='py-2.5'>
                                                {referral.id}
                                            </td>
                                            <td className='py-2.5 font-mono font-medium'>
                                                {referral.code}
                                            </td>
                                            <td className='py-2.5 text-muted-foreground'>
                                                {referral.name || '—'}
                                            </td>
                                            <td className='py-2.5'>
                                                {referral.userName
                                                    ? `${referral.userName} (${referral.userEmail})`
                                                    : '—'}
                                            </td>
                                            <td className='py-2.5 text-right'>
                                                <div className='flex items-center justify-end gap-1'>
                                                    <Button
                                                        size='icon-sm'
                                                        variant='ghost'
                                                        onClick={() =>
                                                            openEdit(referral)
                                                        }>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button
                                                        size='icon-sm'
                                                        variant='ghost'
                                                        className='text-destructive hover:text-destructive'
                                                        onClick={() =>
                                                            handleDelete(
                                                                referral
                                                            )
                                                        }
                                                        disabled={
                                                            deleteMutation.isPending
                                                        }>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                    <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                        <h2 className='mb-1 text-lg font-medium'>
                            {editingId ? 'Edit' : 'Create'} Referral Code
                        </h2>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            {editingId
                                ? 'Update the referral code and assigned user.'
                                : 'Create a new referral code and link it to a user.'}
                        </p>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className='grid gap-4'>
                            <FieldGroup>
                                <Controller
                                    name='code'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='code'>
                                                Code
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='code'
                                                placeholder='e.g. bismark'
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
                                    name='name'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel htmlFor='name'>
                                                Display Name
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id='name'
                                                placeholder='Optional display name'
                                            />
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name='userId'
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor='userId'>
                                                Linked User
                                            </FieldLabel>
                                            <SelectRoot
                                                value={field.value}
                                                onValueChange={field.onChange}>
                                                <SelectTrigger
                                                    id='userId'
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }>
                                                    <SelectValue placeholder='Select a user' />
                                                </SelectTrigger>
                                                <SelectPopup>
                                                    <SelectList>
                                                        {users.map(user => (
                                                            <SelectItem
                                                                key={user.id}
                                                                value={user.id}>
                                                                {user.name} (
                                                                {user.email})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectList>
                                                </SelectPopup>
                                            </SelectRoot>
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <div className='flex justify-end gap-2'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setDialogOpen(false)}>
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
                                        'Update'
                                    ) : (
                                        'Create'
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
