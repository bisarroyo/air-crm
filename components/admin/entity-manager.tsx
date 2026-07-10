'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
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

interface Entity {
    id: number
    [key: string]: string | number | undefined
    isActive: number
    color?: string
}

interface EntityManagerProps {
    title: string
    nameField: string
    apiBase: string
}

export function EntityManager({
    title,
    nameField,
    apiBase
}: EntityManagerProps) {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const schema = z.object({
        [nameField]: z.string().min(1, `${title} name is required`),
        color: z.string().optional()
    })

    type FormValues = z.infer<typeof schema>

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { [nameField]: '', color: '#6b7280' }
    })

    const { data: entities = [], isLoading } = useQuery<Entity[]>({
        queryKey: [apiBase],
        queryFn: async () => {
            const res = await fetch(`/api/${apiBase}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        }
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: [apiBase] })

    const saveMutation = useMutation({
        mutationFn: async (data: FormValues) => {
            const isEdit = editingId !== null
            const url = isEdit
                ? `/api/${apiBase}/${editingId}`
                : `/api/${apiBase}`
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
                `${title} ${editingId ? 'updated' : 'created'} successfully`
            )
            setDialogOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const toggleMutation = useMutation({
        mutationFn: async (entity: Entity) => {
            const res = await fetch(`/api/${apiBase}/${entity.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isActive: entity.isActive ? 0 : 1
                })
            })
            if (!res.ok) throw new Error('Failed to update')
            return res.json()
        },
        onSuccess: (_, entity) => {
            toast.success(
                `${title} ${entity.isActive ? 'deactivated' : 'activated'}`
            )
            invalidate()
        },
        onError: () => toast.error(`Failed to update ${title.toLowerCase()}`)
    })

    const deleteMutation = useMutation({
        mutationFn: async (entity: Entity) => {
            const res = await fetch(`/api/${apiBase}/${entity.id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success(`${title} deleted`)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openCreate = () => {
        setEditingId(null)
        form.reset({ [nameField]: '', color: '#6b7280' })
        setDialogOpen(true)
    }

    const openEdit = (entity: Entity) => {
        setEditingId(entity.id)
        form.reset({
            [nameField]: entity[nameField] as string,
            color: (entity.color as string) || '#6b7280'
        })
        setDialogOpen(true)
    }

    const onSubmit = (data: FormValues) => saveMutation.mutate(data)

    const handleDelete = (entity: Entity) => {
        if (
            !confirm(
                `Are you sure you want to delete this ${title.toLowerCase()}?`
            )
        )
            return
        deleteMutation.mutate(entity)
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className='flex items-center justify-between'>
                        <CardTitle>Manage {title}s</CardTitle>
                        <Button onClick={openCreate} size='sm'>
                            <Plus /> New {title}
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
                                            Name
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Color
                                        </th>
                                        <th className='pb-2 font-medium'>
                                            Active
                                        </th>
                                        <th className='pb-2 font-medium text-right'>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entities.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className='py-8 text-center text-muted-foreground'>
                                                No {title.toLowerCase()}s found
                                            </td>
                                        </tr>
                                    )}
                                    {entities.map(entity => (
                                        <tr
                                            key={entity.id}
                                            className='border-b last:border-0'>
                                            <td className='py-2.5'>
                                                {entity.id}
                                            </td>
                                            <td className='py-2.5'>
                                                <div className='flex items-center gap-2'>
                                                    <span
                                                        className='inline-block h-3 w-3 shrink-0 rounded-full'
                                                        style={{
                                                            backgroundColor:
                                                                (entity.color as string) ||
                                                                '#6b7280'
                                                        }}
                                                    />
                                                    {entity[nameField]}
                                                </div>
                                            </td>
                                            <td className='py-2.5 font-mono text-xs text-muted-foreground'>
                                                {entity.color || '#6b7280'}
                                            </td>
                                            <td className='py-2.5'>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        entity.isActive
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}>
                                                    {entity.isActive
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className='py-2.5 text-right'>
                                                <div className='flex items-center justify-end gap-1'>
                                                    <Button
                                                        size='icon-sm'
                                                        variant='ghost'
                                                        onClick={() =>
                                                            openEdit(entity)
                                                        }>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button
                                                        size='icon-sm'
                                                        variant='ghost'
                                                        onClick={() =>
                                                            toggleMutation.mutate(
                                                                entity
                                                            )
                                                        }
                                                        disabled={
                                                            toggleMutation.isPending
                                                        }>
                                                        {entity.isActive ? (
                                                            <PowerOff
                                                                size={14}
                                                            />
                                                        ) : (
                                                            <Power size={14} />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size='icon-sm'
                                                        variant='ghost'
                                                        className='text-destructive hover:text-destructive'
                                                        onClick={() =>
                                                            handleDelete(
                                                                entity
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
                            {editingId ? 'Edit' : 'Create'} {title}
                        </h2>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            {editingId ? 'Update the' : 'Enter a new'}{' '}
                            {title.toLowerCase()} name and choose a color.
                        </p>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className='grid gap-4'>
                            <FieldGroup>
                                <Controller
                                    name={nameField}
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}>
                                            <FieldLabel
                                                htmlFor={`${apiBase}-name`}>
                                                {title} Name
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id={`${apiBase}-name`}
                                                placeholder={`Enter ${title.toLowerCase()} name`}
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
                                    name='color'
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel
                                                htmlFor={`${apiBase}-color`}>
                                                Color
                                            </FieldLabel>
                                            <div className='flex items-center gap-2'>
                                                <input
                                                    type='color'
                                                    {...field}
                                                    id={`${apiBase}-color`}
                                                    className='h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5'
                                                />
                                                <span className='font-mono text-xs text-muted-foreground'>
                                                    {field.value ||
                                                        '#6b7280'}
                                                </span>
                                            </div>
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
        </>
    )
}
