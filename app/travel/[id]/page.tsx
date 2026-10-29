'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    ExternalLink,
    Inbox,
    Loader2,
    MessageCircle,
    Pencil,
    Plane,
    Trash2
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
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { EventCard } from '@/components/events/events-card'
import { TravelNotes } from '@/components/travel/travel-notes'
import { useSession } from '@/hooks/use-session'

interface TravelLeadDetail {
    id: number
    name: string
    phone: string
    email: string
    metaInboxUrl: string | null
    statusId: number
    createdAt: string | null
    updatedAt: string | null
    statusName: string | null
    statusIsActive: number | null
    statusColor: string | null
}

interface StatusLabel {
    id: number
    name: string
    color: string
}

const travelLeadSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').or(z.literal('')),
    metaInboxUrl: z.string().optional(),
    statusId: z.string().min(1, 'El estado es obligatorio')
})

type TravelLeadFormValues = z.infer<typeof travelLeadSchema>

function ColorDot({ color }: { color: string }) {
    return (
        <span
            className='inline-block h-3 w-3 shrink-0 rounded-full'
            style={{ backgroundColor: color || '#6b7280' }}
        />
    )
}

async function copyValue(value: string, label: string) {
    if (!value) {
        toast.error(`No hay ${label} para copiar`)
        return
    }
    try {
        await navigator.clipboard.writeText(value)
        toast.success(`${label} copiado al portapapeles`)
    } catch {
        toast.error(`No se pudo copiar el ${label}`)
    }
}

export default function TravelDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [modalOpen, setModalOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')

    const form = useForm<TravelLeadFormValues>({
        resolver: zodResolver(travelLeadSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            metaInboxUrl: '',
            statusId: ''
        }
    })

    const { data: lead, isLoading } = useQuery<TravelLeadDetail>({
        queryKey: ['travel-lead', id],
        queryFn: async () => {
            const res = await fetch(`/api/travel/leads/${id}`)
            if (!res.ok) {
                if (res.status === 404) {
                    toast.error('Lead de viaje no encontrado')
                    router.push('/travel')
                }
                throw new Error('No se pudo cargar')
            }
            return res.json()
        }
    })

    const { data: statuses = [] } = useQuery({
        queryKey: ['travel-statuses'],
        queryFn: () => fetch('/api/travel/status').then((r) => r.json()),
        select: (data: Array<{ id: number; status: string; color: string }>) =>
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

    const updateMutation = useMutation({
        mutationFn: async (data: TravelLeadFormValues) => {
            const res = await fetch(`/api/travel/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    phone: data.phone ?? '',
                    email: data.email ?? '',
                    metaInboxUrl: data.metaInboxUrl ?? '',
                    statusId: Number(data.statusId)
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo actualizar')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Lead actualizado')
            setModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['travel-lead', id] })
            queryClient.invalidateQueries({ queryKey: ['travel-leads'] })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/travel/leads/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo eliminar')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Lead eliminado')
            queryClient.invalidateQueries({ queryKey: ['travel-leads'] })
            router.push('/travel')
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const openEdit = () => {
        if (!lead) return
        form.reset({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            metaInboxUrl: lead.metaInboxUrl ?? '',
            statusId: String(lead.statusId)
        })
        setModalOpen(true)
    }

    const handleDelete = () => {
        if (deleteConfirmText !== 'confirm') return
        deleteMutation.mutate()
        setDeleteDialogOpen(false)
        setDeleteConfirmText('')
    }

    if (isLoading) {
        return <GlobeLoader fullScreen={false} className='py-32' />
    }

    if (!lead) return null

    return (
        <div className='container mx-auto p-6'>
            <div className='mb-6 flex flex-wrap items-center gap-4'>
                <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Volver'
                    onClick={() => router.push('/travel')}>
                    <ArrowLeft size={16} />
                </Button>
                <div className='flex-1'>
                    <h1 className='flex items-center gap-2 text-xl font-medium'>
                        <Plane size={18} className='text-primary' />
                        {lead.name}
                    </h1>
                    <p className='text-sm text-muted-foreground'>
                        Lead de viaje #{lead.id}
                    </p>
                </div>
                <div className='flex gap-2'>
                    <Button size='sm' onClick={openEdit}>
                        <Pencil size={14} /> Editar
                    </Button>
                    {isAdmin && (
                        <Button
                            size='sm'
                            variant='destructive'
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? (
                                <Loader2
                                    size={14}
                                    className='animate-spin'
                                />
                            ) : (
                                <Trash2 size={14} />
                            )}
                            Eliminar
                        </Button>
                    )}
                </div>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>Información de contacto</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Correo electrónico
                            </p>
                            <button
                                type='button'
                                title='Copiar correo'
                                className='cursor-pointer text-left text-sm hover:underline'
                                onClick={() =>
                                    copyValue(lead.email, 'Correo')
                                }>
                                {lead.email || 'No especificado'}
                            </button>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Teléfono
                            </p>
                            <div className='flex items-center gap-2'>
                                <button
                                    type='button'
                                    title='Copiar teléfono'
                                    className='cursor-pointer text-left text-sm hover:underline'
                                    onClick={() =>
                                        copyValue(lead.phone, 'Teléfono')
                                    }>
                                    {lead.phone || 'No especificado'}
                                </button>
                                {lead.phone && (
                                    <a
                                        href={`https://web.whatsapp.com/send/?phone=${lead.phone.replace(/\D/g, '')}&text&type=phone_number&app_absent=0`}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-green-700'>
                                        <MessageCircle size={12} />
                                        WhatsApp
                                    </a>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Meta Inbox
                            </p>
                            {lead.metaInboxUrl ? (
                                <div className='mt-1 flex items-center gap-2'>
                                    <a
                                        href={lead.metaInboxUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='inline-flex items-center gap-1 text-sm text-primary hover:underline'>
                                        <Inbox size={14} /> Abrir en Meta
                                        <ExternalLink size={12} />
                                    </a>
                                    <Button
                                        size='icon-xs'
                                        variant='ghost'
                                        title='Copiar enlace'
                                        onClick={() =>
                                            copyValue(
                                                lead.metaInboxUrl as string,
                                                'Enlace'
                                            )
                                        }>
                                        <ExternalLink size={12} />
                                    </Button>
                                </div>
                            ) : (
                                <p className='text-sm text-muted-foreground'>
                                    No especificado
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Estado</CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Estado actual
                            </p>
                            <div className='mt-1 flex items-center gap-2'>
                                <ColorDot
                                    color={lead.statusColor || '#6b7280'}
                                />
                                <span className='inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                                    {lead.statusName || 'Desconocido'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Creado
                            </p>
                            <p className='text-sm'>
                                {lead.createdAt
                                    ? new Date(
                                          lead.createdAt
                                      ).toLocaleString('es', {
                                          dateStyle: 'long',
                                          timeStyle: 'short'
                                      })
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                                Última actualización
                            </p>
                            <p className='text-sm'>
                                {lead.updatedAt
                                    ? new Date(
                                          lead.updatedAt
                                      ).toLocaleString('es', {
                                          dateStyle: 'long',
                                          timeStyle: 'short'
                                      })
                                    : '—'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className='md:col-span-2'>
                    <TravelNotes leadId={lead.id} />
                </div>
                <div className='md:col-span-2'>
                    <EventCard
                        customerId={lead.id}
                        apiBase={`/api/travel/leads/${lead.id}`}
                    />
                </div>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
                    <DialogHeader>
                        <DialogTitle>Editar lead de viaje</DialogTitle>
                        <DialogDescription>
                            Actualizá los datos del lead.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={form.handleSubmit((data) =>
                            updateMutation.mutate(data)
                        )}
                        className='grid gap-4'>
                        <FieldGroup>
                            <Controller
                                name='name'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='edit-travel-name'>
                                            Nombre
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-travel-name'
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
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='edit-travel-phone'>
                                            Teléfono
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-travel-phone'
                                            type='tel'
                                            placeholder='+506 8888 8888'
                                        />
                                    </Field>
                                )}
                            />
                            <Controller
                                name='email'
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor='edit-travel-email'>
                                            Correo electrónico
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-travel-email'
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
                                        <FieldLabel htmlFor='edit-travel-meta'>
                                            Enlace a Meta Inbox
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id='edit-travel-meta'
                                            inputMode='url'
                                            placeholder='https://business.facebook.com/...'
                                        />
                                    </Field>
                                )}
                            />
                            <Controller
                                name='statusId'
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor='edit-travel-status'>
                                            Estado
                                        </FieldLabel>
                                        <Select
                                            value={field.value}
                                            items={statusItems}
                                            onValueChange={field.onChange}>
                                            <SelectTrigger id='edit-travel-status'>
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
                                disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? (
                                    <Loader2
                                        size={16}
                                        className='animate-spin'
                                    />
                                ) : (
                                    'Guardar cambios'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Eliminar lead</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. Se eliminarán
                            también sus notas y eventos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-3'>
                        <p className='text-sm text-muted-foreground'>
                            Escribí <span className='font-mono'>confirm</span>{' '}
                            para eliminar definitivamente.
                        </p>
                        <Input
                            value={deleteConfirmText}
                            onChange={(e) =>
                                setDeleteConfirmText(e.target.value)
                            }
                            placeholder='confirm'
                        />
                        <div className='flex justify-end gap-2'>
                            <Button
                                variant='ghost'
                                onClick={() => setDeleteDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant='destructive'
                                disabled={
                                    deleteConfirmText !== 'confirm' ||
                                    deleteMutation.isPending
                                }
                                onClick={handleDelete}>
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
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
