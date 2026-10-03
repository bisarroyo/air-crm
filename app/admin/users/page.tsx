'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import {
    Loader2,
    Plus,
    Pencil,
    Trash2,
    Ban,
    Unlock,
    KeyRound,
    UserCog,
    Search,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel
} from '@/components/ui/field'
import {
    SelectItem,
    SelectGroup,
    SelectContent,
    Select,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const LIMIT = 15

interface User {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    role?: string | null
    banned?: boolean | null
    banReason?: string | null
    banExpires?: string | null
    createdAt: string
    updatedAt: string
}

interface ListUsersResponse {
    users: User[]
    total: number
    limit: number
    offset: number
}

const createSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    role: z.string().optional()
})

const editSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    email: z.string().email('Email inválido'),
    role: z.string().optional()
})

const passwordSchema = z.object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

const banSchema = z.object({
    reason: z.string().optional(),
    expiration: z.string().optional()
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>
type PasswordForm = z.infer<typeof passwordSchema>
type BanForm = z.infer<typeof banSchema>

export default function AdminUsersPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [showCreate, setShowCreate] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [passwordUser, setPasswordUser] = useState<User | null>(null)
    const [banUser, setBanUser] = useState<User | null>(null)
    const [deleteUser, setDeleteUser] = useState<User | null>(null)

    const createForm = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
        defaultValues: { name: '', email: '', password: '', role: 'user' }
    })

    const editForm = useForm<EditForm>({
        resolver: zodResolver(editSchema),
        values: editingUser
            ? {
                  name: editingUser.name,
                  email: editingUser.email,
                  role: editingUser.role || 'user'
              }
            : { name: '', email: '', role: 'user' }
    })

    const passwordForm = useForm<PasswordForm>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: '' }
    })

    const banForm = useForm<BanForm>({
        resolver: zodResolver(banSchema),
        defaultValues: { reason: '', expiration: '' }
    })

    const { data, isLoading } = useQuery<ListUsersResponse>({
        queryKey: ['admin-users', search, page],
        queryFn: async () => {
            const { data, error } = await authClient.admin.listUsers({
                query: {
                    limit: LIMIT,
                    offset: page * LIMIT,
                    ...(search
                        ? {
                              searchValue: search,
                              searchField: 'name',
                              searchOperator: 'contains'
                          }
                        : {})
                }
            })
            if (error) throw new Error(error.message || 'No se pudieron listar los usuarios')
            return data as unknown as ListUsersResponse
        }
    })

    const users = data?.users ?? []
    const total = data?.total ?? 0
    const totalPages = Math.ceil(total / LIMIT)

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['admin-users'] })

    const createMutation = useMutation({
        mutationFn: async (form: CreateForm) => {
            const { data, error } = await authClient.admin.createUser({
                name: form.name,
                email: form.email,
                password: form.password,
                role: (form.role || 'user') as 'user' | 'admin' | 'ref'
            })
            if (error) throw new Error(error.message || 'No se pudo crear el usuario')
            return data
        },
        onSuccess: () => {
            toast.success('Usuario creado correctamente')
            setShowCreate(false)
            createForm.reset()
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const updateMutation = useMutation({
        mutationFn: async (form: EditForm) => {
            if (!editingUser) throw new Error('No hay ningún usuario seleccionado')
            const { data, error } = await authClient.admin.updateUser({
                userId: editingUser.id,
                data: {
                    name: form.name,
                    email: form.email,
                    role: form.role || 'user'
                }
            })
            if (error) throw new Error(error.message || 'No se pudo actualizar el usuario')
            return data
        },
        onSuccess: () => {
            toast.success('Usuario actualizado correctamente')
            setEditingUser(null)
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const passwordMutation = useMutation({
        mutationFn: async (form: PasswordForm) => {
            if (!passwordUser) throw new Error('No hay ningún usuario seleccionado')
            const { data, error } = await authClient.admin.setUserPassword({
                userId: passwordUser.id,
                newPassword: form.newPassword
            })
            if (error)
                throw new Error(error.message || 'No se pudo establecer la contraseña')
            return data
        },
        onSuccess: () => {
            toast.success('Contraseña establecida correctamente')
            setPasswordUser(null)
            passwordForm.reset()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const banMutation = useMutation({
        mutationFn: async ({
            user,
            reason,
            expiration
        }: {
            user: User
            reason?: string
            expiration?: string
        }) => {
            if (user.banned) {
                const { error } = await authClient.admin.unbanUser({
                    userId: user.id
                })
                if (error) throw new Error(error.message)
            } else {
                const banExpiresIn = expiration
                    ? parseInt(expiration)
                    : undefined
                const { error } = await authClient.admin.banUser({
                    userId: user.id,
                    banReason: reason || undefined,
                    banExpiresIn
                })
                if (error) throw new Error(error.message)
            }
        },
        onSuccess: () => {
            toast.success('Estado del usuario actualizado')
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async (user: User) => {
            const { data, error } = await authClient.admin.removeUser({
                userId: user.id
            })
            if (error) throw new Error(error.message || 'No se pudo eliminar el usuario')
            return data
        },
        onSuccess: () => {
            toast.success('Usuario eliminado')
            setDeleteUser(null)
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const impersonateMutation = useMutation({
        mutationFn: async (user: User) => {
            const { data, error } = await authClient.admin.impersonateUser({
                userId: user.id
            })
            if (error) throw new Error(error.message || 'No se pudo suplantar al usuario')
            return data as { url?: string } | null
        },
        onSuccess: (data: { url?: string } | null) => {
            toast.success('Suplantando al usuario')
            if (data?.url) window.location.href = data.url
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const handleBan = (data: BanForm) => {
        if (!banUser) return
        banMutation.mutate({
            user: banUser,
            reason: data.reason,
            expiration: data.expiration
        })
        setBanUser(null)
        banForm.reset()
    }

    const handleUnban = (user: User) => {
        if (!confirm(`Unban user "${user.name}"?`)) return
        banMutation.mutate({ user })
    }

    const handleDeleteConfirm = () => {
        if (!deleteUser) return
        deleteMutation.mutate(deleteUser)
    }

    return (
        <TooltipProvider delay={400}>
            <div className='container mx-auto p-6'>
                <Card>
                    <CardHeader>
                        <div className='flex items-center justify-between gap-4 flex-wrap'>
                            <CardTitle>Administrar usuarios</CardTitle>
                            <div className='flex items-center gap-2'>
                                <div className='relative'>
                                    <Search
                                        size={14}
                                        className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                                    />
                                    <Input
                                        placeholder='Buscar usuarios...'
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value)
                                            setPage(0)
                                        }}
                                        className='w-48 pl-8 h-8 text-sm'
                                    />
                                </div>
                                <Button
                                    onClick={() => {
                                        createForm.reset()
                                        setShowCreate(true)
                                    }}
                                    size='sm'>
                                    <Plus /> Nuevo usuario
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <GlobeLoader
                                fullScreen={false}
                                className='py-8'
                                size={100}
                            />
                        ) : (
                            <>
                                <div className='overflow-x-auto'>
                                    <table className='w-full text-sm'>
                                        <thead>
                                            <tr className='border-b text-left text-muted-foreground'>
                                                <th className='pb-2 font-medium'>
                                                    Nombre
                                                </th>
                                                <th className='pb-2 font-medium'>
                                                    Email
                                                </th>
                                                <th className='pb-2 font-medium'>
                                                    Rol
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
                                            {users.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className='py-8 text-center text-muted-foreground'>
                                                        No se encontraron usuarios
                                                    </td>
                                                </tr>
                                            )}
                                            {users.map((user) => (
                                                <tr
                                                    key={user.id}
                                                    className='border-b last:border-0'>
                                                    <td className='py-2.5 font-medium'>
                                                        {user.name}
                                                    </td>
                                                    <td className='py-2.5 text-muted-foreground'>
                                                        {user.email}
                                                    </td>
                                                    <td className='py-2.5'>
                                                        <span
                                                            className={
                                                                user.role ===
                                                                'admin'
                                                                    ? 'text-amber-600 font-medium'
                                                                    : ''
                                                            }>
                                                            {user.role ||
                                                                'user'}
                                                        </span>
                                                    </td>
                                                    <td className='py-2.5'>
                                                        {user.banned ? (
                                                            <span className='text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-full'>
                                                                Bloqueado
                                                                {user.banReason
                                                                    ? `: ${user.banReason}`
                                                                    : ''}
                                                            </span>
                                                        ) : (
                                                            <span className='text-green-600 text-xs font-medium bg-green-600/10 px-2 py-0.5 rounded-full'>
                                                                Activo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className='py-2.5 text-right'>
                                                        <div className='flex items-center justify-end gap-1'>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    render={
                                                                        <Button
                                                                            size='icon-sm'
                                                                            variant='ghost'
                                                                            className='cursor-pointer'
                                                                            onClick={() =>
                                                                                setEditingUser(
                                                                                    user
                                                                                )
                                                                            }
                                                                        />
                                                                    }>
                                                                    <Pencil
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Editar usuario
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    render={
                                                                        <Button
                                                                            size='icon-sm'
                                                                            variant='ghost'
                                                                            className='cursor-pointer'
                                                                            onClick={() => {
                                                                                passwordForm.reset()
                                                                                setPasswordUser(
                                                                                    user
                                                                                )
                                                                            }}
                                                                        />
                                                                    }>
                                                                    <KeyRound
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Establecer contraseña
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    render={
                                                                        <Button
                                                                            size='icon-sm'
                                                                            variant='ghost'
                                                                            className='cursor-pointer'
                                                                            onClick={() =>
                                                                                impersonateMutation.mutate(
                                                                                    user
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                impersonateMutation.isPending
                                                                            }
                                                                        />
                                                                    }>
                                                                    <UserCog
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Suplantar
                                                                    usuario
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    render={
                                                                        <Button
                                                                            size='icon-sm'
                                                                            variant='ghost'
                                                                            className={
                                                                                user.banned
                                                                                    ? 'cursor-pointer text-green-600'
                                                                                    : 'cursor-pointer text-amber-600'
                                                                            }
                                                                            onClick={() =>
                                                                                user.banned
                                                                                    ? handleUnban(
                                                                                          user
                                                                                      )
                                                                                    : setBanUser(
                                                                                          user
                                                                                      )
                                                                            }
                                                                            disabled={
                                                                                banMutation.isPending
                                                                            }
                                                                        />
                                                                    }>
                                                                    {user.banned ? (
                                                                        <Unlock
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <Ban
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    )}
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {user.banned
                                                                        ? 'Desbloquear usuario'
                                                                        : 'Bloquear usuario'}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    render={
                                                                        <Button
                                                                            size='icon-sm'
                                                                            variant='ghost'
                                                                            className='cursor-pointer text-destructive hover:text-destructive'
                                                                            onClick={() =>
                                                                                setDeleteUser(
                                                                                    user
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                deleteMutation.isPending
                                                                            }
                                                                        />
                                                                    }>
                                                                    <Trash2
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Eliminar usuario
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalPages > 1 && (
                                    <div className='flex items-center justify-between pt-4 text-sm text-muted-foreground'>
                                        <span>{total} usuarios en total</span>
                                        <div className='flex items-center gap-2'>
                                            <Button
                                                size='icon-sm'
                                                variant='ghost'
                                                className='cursor-pointer'
                                                disabled={page === 0}
                                                onClick={() =>
                                                    setPage((p) => p - 1)
                                                }>
                                                <ChevronLeft size={14} />
                                            </Button>
                                            <span className='tabular-nums'>
                                                Página {page + 1} de {totalPages}
                                            </span>
                                            <Button
                                                size='icon-sm'
                                                variant='ghost'
                                                className='cursor-pointer'
                                                disabled={
                                                    page >= totalPages - 1
                                                }
                                                onClick={() =>
                                                    setPage((p) => p + 1)
                                                }>
                                                <ChevronRight size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>Crear usuario</DialogTitle>
                            <DialogDescription>
                                Creá una nueva cuenta de usuario.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={createForm.handleSubmit((data) =>
                                createMutation.mutate(data)
                            )}
                            className='grid gap-4'>
                                <FieldGroup>
                                    <Controller
                                        name='name'
                                        control={createForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Nombre</FieldLabel>
                                                <Input
                                                    {...field}
                                                    placeholder='Nombre completo'
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
                                        control={createForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Email</FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='email'
                                                    placeholder='user@example.com'
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
                                        name='password'
                                        control={createForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>
                                                    Contraseña
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='password'
                                                    placeholder='Mínimo 8 caracteres'
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
                                        name='role'
                                        control={createForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Rol</FieldLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }>
                                                        <SelectValue placeholder='Elegí un rol' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value='user'>
                                                                Usuario
                                                            </SelectItem>
                                                            <SelectItem value='ref'>
                                                                Referido
                                                            </SelectItem>
                                                            <SelectItem value='admin'>
                                                                Administrador
                                                            </SelectItem>
                                                            <SelectItem value='pending'>
                                                                Pendiente
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
                                        Cancelar
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
                                            'Crear'
                                        )}
                                    </Button>
                                </div>
                            </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>Editar usuario</DialogTitle>
                            <DialogDescription>
                                Actualizá los datos del usuario.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                                onSubmit={editForm.handleSubmit((data) =>
                                    updateMutation.mutate(data)
                                )}
                                className='grid gap-4'>
                                <FieldGroup>
                                    <Controller
                                        name='name'
                                        control={editForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Nombre</FieldLabel>
                                                <Input
                                                    {...field}
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
                                        control={editForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Email</FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='email'
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
                                        name='role'
                                        control={editForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>Rol</FieldLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }>
                                                        <SelectValue placeholder='Elegí un rol' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value='user'>
                                                                Usuario
                                                            </SelectItem>
                                                            <SelectItem value='ref'>
                                                                Referido
                                                            </SelectItem>
                                                            <SelectItem value='admin'>
                                                                Administrador
                                                            </SelectItem>
                                                            <SelectItem value='pending'>
                                                                Pendiente
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
                                        onClick={() => setEditingUser(null)}>
                                        Cancelar
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
                                            'Guardar'
                                        )}
                                    </Button>
                                </div>
                            </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>Establecer contraseña</DialogTitle>
                            <DialogDescription>
                                Establecé una nueva contraseña para{' '}
                                <strong>{passwordUser?.name}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={passwordForm.handleSubmit((data) =>
                                passwordMutation.mutate(data)
                            )}
                            className='grid gap-4'>
                                <FieldGroup>
                                    <Controller
                                        name='newPassword'
                                        control={passwordForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>
                                                    Nueva contraseña
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='password'
                                                    placeholder='Mínimo 8 caracteres'
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
                                </FieldGroup>
                                <div className='flex justify-end gap-2'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        className='cursor-pointer'
                                        onClick={() => setPasswordUser(null)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        type='submit'
                                        disabled={passwordMutation.isPending}>
                                        {passwordMutation.isPending ? (
                                            <Loader2
                                                size={16}
                                                className='animate-spin'
                                            />
                                        ) : (
                                            'Establecer contraseña'
                                        )}
                                    </Button>
                                </div>
                            </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={!!banUser && !banUser.banned}
                    onOpenChange={(open) => {
                        if (!open) {
                            setBanUser(null)
                            banForm.reset()
                        }
                    }}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>Bloquear usuario</DialogTitle>
                            <DialogDescription>
                                Bloqueá a <strong>{banUser?.name}</strong> (
                                {banUser?.email})
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={banForm.handleSubmit(handleBan)}
                            className='grid gap-4'>
                                <FieldGroup>
                                    <Controller
                                        name='reason'
                                        control={banForm.control}
                                        render={({ field }) => (
                                            <Field>
                                                <FieldLabel>
                                                    Motivo del bloqueo
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    placeholder='Motivo del bloqueo (opcional)'
                                                />
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name='expiration'
                                        control={banForm.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }>
                                                <FieldLabel>
                                                    Duración del bloqueo
                                                </FieldLabel>
                                                <Select
                                                    value={field.value || ''}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Permanente (nunca expira)' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value=''>
                                                                Permanente
                                                            </SelectItem>
                                                            <SelectItem value='3600'>
                                                                1 hora
                                                            </SelectItem>
                                                            <SelectItem value='86400'>
                                                                1 día
                                                            </SelectItem>
                                                            <SelectItem value='604800'>
                                                                7 días
                                                            </SelectItem>
                                                            <SelectItem value='2592000'>
                                                                30 días
                                                            </SelectItem>
                                                            <SelectItem value='7776000'>
                                                                90 días
                                                            </SelectItem>
                                                            <SelectItem value='31536000'>
                                                                1 año
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
                                        onClick={() => {
                                            setBanUser(null)
                                            banForm.reset()
                                        }}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        type='submit'
                                        disabled={banMutation.isPending}
                                        variant='destructive'>
                                        {banMutation.isPending ? (
                                            <Loader2
                                                size={16}
                                                className='animate-spin'
                                            />
                                        ) : (
                                            'Bloquear usuario'
                                        )}
                                    </Button>
                                </div>
                            </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>Eliminar usuario</DialogTitle>
                            <DialogDescription>
                                ¿Seguro que querés eliminar definitivamente a{' '}
                                <strong>{deleteUser?.name}</strong> (
                                {deleteUser?.email})? Esta acción no se puede
                                deshacer.
                            </DialogDescription>
                        </DialogHeader>
                        <div className='flex justify-end gap-2'>
                            <Button
                                type='button'
                                variant='ghost'
                                className='cursor-pointer'
                                onClick={() => setDeleteUser(null)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleDeleteConfirm}
                                disabled={deleteMutation.isPending}
                                variant='destructive'>
                                {deleteMutation.isPending ? (
                                    <Loader2
                                        size={16}
                                        className='animate-spin'
                                    />
                                ) : (
                                    'Eliminar'
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    )
}
