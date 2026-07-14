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
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.string().optional()
})

const editSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
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
            if (error) throw new Error(error.message || 'Failed to list users')
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
            if (error) throw new Error(error.message || 'Failed to create user')
            return data
        },
        onSuccess: () => {
            toast.success('User created successfully')
            setShowCreate(false)
            createForm.reset()
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const updateMutation = useMutation({
        mutationFn: async (form: EditForm) => {
            if (!editingUser) throw new Error('No user selected')
            const { data, error } = await authClient.admin.updateUser({
                userId: editingUser.id,
                data: {
                    name: form.name,
                    email: form.email,
                    role: form.role || 'user'
                }
            })
            if (error) throw new Error(error.message || 'Failed to update user')
            return data
        },
        onSuccess: () => {
            toast.success('User updated successfully')
            setEditingUser(null)
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const passwordMutation = useMutation({
        mutationFn: async (form: PasswordForm) => {
            if (!passwordUser) throw new Error('No user selected')
            const { data, error } = await authClient.admin.setUserPassword({
                userId: passwordUser.id,
                newPassword: form.newPassword
            })
            if (error)
                throw new Error(error.message || 'Failed to set password')
            return data
        },
        onSuccess: () => {
            toast.success('Password set successfully')
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
            toast.success('User status updated')
            invalidate()
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async (user: User) => {
            const { data, error } = await authClient.admin.removeUser({
                userId: user.id
            })
            if (error) throw new Error(error.message || 'Failed to delete user')
            return data
        },
        onSuccess: () => {
            toast.success('User deleted')
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
            if (error) throw new Error(error.message || 'Failed to impersonate')
            return data as { url?: string } | null
        },
        onSuccess: (data: { url?: string } | null) => {
            toast.success('Impersonating user')
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
                            <CardTitle>Manage Users</CardTitle>
                            <div className='flex items-center gap-2'>
                                <div className='relative'>
                                    <Search
                                        size={14}
                                        className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                                    />
                                    <Input
                                        placeholder='Search users...'
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
                                    <Plus /> New User
                                </Button>
                            </div>
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
                            <>
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
                                                    Role
                                                </th>
                                                <th className='pb-2 font-medium'>
                                                    Status
                                                </th>
                                                <th className='pb-2 font-medium text-right'>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className='py-8 text-center text-muted-foreground'>
                                                        No users found
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
                                                                Banned
                                                                {user.banReason
                                                                    ? `: ${user.banReason}`
                                                                    : ''}
                                                            </span>
                                                        ) : (
                                                            <span className='text-green-600 text-xs font-medium bg-green-600/10 px-2 py-0.5 rounded-full'>
                                                                Active
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
                                                                    Edit user
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
                                                                    Set password
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
                                                                    Impersonate
                                                                    user
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
                                                                        ? 'Unban user'
                                                                        : 'Ban user'}
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
                                                                    Delete user
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
                                        <span>{total} total users</span>
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
                                                Page {page + 1} of {totalPages}
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

                {showCreate && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                        <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                            <h2 className='mb-1 text-lg font-medium'>
                                Create User
                            </h2>
                            <p className='mb-4 text-sm text-muted-foreground'>
                                Create a new user account.
                            </p>
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
                                                    Password
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='password'
                                                    placeholder='Min 8 characters'
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
                                                <FieldLabel>Role</FieldLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }>
                                                        <SelectValue placeholder='Select role' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value='user'>
                                                                User
                                                            </SelectItem>
                                                            <SelectItem value='ref'>
                                                                Ref
                                                            </SelectItem>
                                                            <SelectItem value='admin'>
                                                                Admin
                                                            </SelectItem>
                                                            <SelectItem value='pending'>
                                                                Pending
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
                                            'Create'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {editingUser && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                        <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                            <h2 className='mb-1 text-lg font-medium'>
                                Edit User
                            </h2>
                            <p className='mb-4 text-sm text-muted-foreground'>
                                Update user details.
                            </p>
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
                                                <FieldLabel>Name</FieldLabel>
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
                                                <FieldLabel>Role</FieldLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }>
                                                        <SelectValue placeholder='Select role' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value='user'>
                                                                User
                                                            </SelectItem>
                                                            <SelectItem value='ref'>
                                                                Ref
                                                            </SelectItem>
                                                            <SelectItem value='admin'>
                                                                Admin
                                                            </SelectItem>
                                                            <SelectItem value='pending'>
                                                                Pending
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
                                            'Save'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {passwordUser && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                        <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                            <h2 className='mb-1 text-lg font-medium'>
                                Set Password
                            </h2>
                            <p className='mb-4 text-sm text-muted-foreground'>
                                Set a new password for{' '}
                                <strong>{passwordUser.name}</strong>.
                            </p>
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
                                                    New Password
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    type='password'
                                                    placeholder='Min 8 characters'
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
                                        Cancel
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
                                            'Set Password'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {banUser && !banUser.banned && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                        <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                            <h2 className='mb-1 text-lg font-medium'>
                                Ban User
                            </h2>
                            <p className='mb-4 text-sm text-muted-foreground'>
                                Ban <strong>{banUser.name}</strong> (
                                {banUser.email})
                            </p>
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
                                                    Ban Reason
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    placeholder='Reason for the ban (optional)'
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
                                                    Ban Duration
                                                </FieldLabel>
                                                <Select
                                                    value={field.value || ''}
                                                    onValueChange={
                                                        field.onChange
                                                    }>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Permanent (never expires)' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value=''>
                                                                Permanent
                                                            </SelectItem>
                                                            <SelectItem value='3600'>
                                                                1 hour
                                                            </SelectItem>
                                                            <SelectItem value='86400'>
                                                                1 day
                                                            </SelectItem>
                                                            <SelectItem value='604800'>
                                                                7 days
                                                            </SelectItem>
                                                            <SelectItem value='2592000'>
                                                                30 days
                                                            </SelectItem>
                                                            <SelectItem value='7776000'>
                                                                90 days
                                                            </SelectItem>
                                                            <SelectItem value='31536000'>
                                                                1 year
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
                                        Cancel
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
                                            'Ban User'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {deleteUser && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
                        <div className='mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10'>
                            <h2 className='mb-1 text-lg font-medium'>
                                Delete User
                            </h2>
                            <p className='mb-4 text-sm text-muted-foreground'>
                                Are you sure you want to permanently delete{' '}
                                <strong>{deleteUser.name}</strong> (
                                {deleteUser.email})? This action cannot be
                                undone.
                            </p>
                            <div className='flex justify-end gap-2'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    className='cursor-pointer'
                                    onClick={() => setDeleteUser(null)}>
                                    Cancel
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
                                        'Delete'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
