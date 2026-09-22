'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    CalendarClock,
    Copy,
    ExternalLink,
    Pencil,
    Trash2
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { useSession } from '@/hooks/use-session'
import {
    EVENT_STATUS_META,
    EVENT_TYPE_META,
    formatScheduledAt,
    type CustomerEvent,
    type EventStatus,
    normalizeMeetingLink
} from './shared'
import { CreateEventButton, EditEventDialog } from './event-form'

function copyLink(link: string) {
    navigator.clipboard
        .writeText(link)
        .then(() => toast.success('Enlace copiado'))
        .catch(() => toast.error('No se pudo copiar el enlace'))
}

function EventItem({
    event,
    onStatusChange,
    onEdit,
    onDelete,
    isUpdatingStatus,
    canManage
}: {
    event: CustomerEvent
    onStatusChange: (event: CustomerEvent, status: EventStatus) => void
    onEdit: (event: CustomerEvent) => void
    onDelete: (event: CustomerEvent) => void
    isUpdatingStatus: boolean
    canManage: boolean
}) {
    const meta = EVENT_TYPE_META[event.type]
    const Icon = meta.icon
    const statusMeta = EVENT_STATUS_META[event.status]

    return (
        <div
            className={cn(
                'rounded-lg border border-border/60 bg-muted/40 p-3 text-sm'
            )}>
            <div className='flex items-start justify-between gap-2'>
                <div className='flex items-start gap-2'>
                    <span
                        className={cn(
                            'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            meta.badge
                        )}>
                        <Icon size={12} className='mr-1' />
                        {meta.label}
                    </span>
                    {event.title && (
                        <p className='font-medium'>{event.title}</p>
                    )}
                </div>
                <div className='flex shrink-0 items-center gap-1.5'>
                    {event.meetingLink && (
                        <Button
                            variant='ghost'
                            size='icon-xs'
                            aria-label='Copiar enlace'
                            title='Copiar enlace'
                            onClick={() =>
                                copyLink(event.meetingLink as string)
                            }>
                            <Copy size={12} />
                        </Button>
                    )}
                    {canManage && (
                        <>
                            <Button
                                variant='ghost'
                                size='icon-xs'
                                aria-label='Editar evento'
                                title='Editar evento'
                                onClick={() => onEdit(event)}
                                disabled={isUpdatingStatus}>
                                <Pencil size={12} />
                            </Button>
                            <Button
                                variant='ghost'
                                size='icon-xs'
                                aria-label='Eliminar evento'
                                onClick={() => onDelete(event)}
                                disabled={isUpdatingStatus}>
                                <Trash2 size={12} />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className='mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                <span className='inline-flex items-center gap-1'>
                    <CalendarClock size={12} />
                    {formatScheduledAt(event.scheduledAt)}
                </span>
                {event.userName && (
                    <span>· {event.userName}</span>
                )}
            </div>

            {event.meetingLink && (
                <div className='mt-2 flex items-center gap-2'>
                    <a
                        href={normalizeMeetingLink(event.meetingLink as string)}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex min-w-0 flex-1 items-center gap-1 truncate rounded-md bg-background px-2 py-1 text-xs text-primary ring-1 ring-border hover:underline'>
                        <ExternalLink size={12} className='shrink-0' />
                        <span className='truncate'>{event.meetingLink}</span>
                    </a>
                    <Button
                        variant='outline'
                        size='xs'
                        onClick={() => copyLink(event.meetingLink as string)}>
                        <Copy size={12} /> Copiar
                    </Button>
                </div>
            )}

            <div className='mt-2 flex flex-wrap items-center gap-2'>
                <span
                    className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        statusMeta.badge
                    )}>
                    {statusMeta.label}
                </span>
                <Select
                    value={event.status}
                    onValueChange={(v) =>
                        onStatusChange(event, v as EventStatus)
                    }>
                    <SelectTrigger size='sm' className='h-7 text-xs'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value='pending'>Pendiente</SelectItem>
                            <SelectItem value='attended'>Asistió</SelectItem>
                            <SelectItem value='no_show'>No asistió</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

export function EventCard({ customerId }: { customerId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [statusPendingId, setStatusPendingId] = useState<number | null>(null)
    const [editingEvent, setEditingEvent] = useState<CustomerEvent | null>(
        null
    )

    const { data: events = [], isLoading } = useQuery<CustomerEvent[]>({
        queryKey: ['events', customerId],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/events`)
            if (!res.ok) throw new Error('Failed to fetch events')
            return res.json()
        }
    })

    const statusMutation = useMutation({
        mutationFn: async ({
            event,
            status
        }: {
            event: CustomerEvent
            status: EventStatus
        }) => {
            const res = await fetch(
                `/api/customers/${customerId}/events/${event.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update event')
            }
            return res.json()
        },
        onMutate: async ({ event, status }) => {
            setStatusPendingId(event.id)
            await queryClient.cancelQueries({
                queryKey: ['events', customerId]
            })
            const previous = queryClient.getQueryData<CustomerEvent[]>([
                'events',
                customerId
            ])
            queryClient.setQueryData<CustomerEvent[]>(
                ['events', customerId],
                (old) =>
                    old?.map((e) =>
                        e.id === event.id ? { ...e, status } : e
                    ) ?? []
            )
            return { previous }
        },
        onError: (error: Error, _variables, context) => {
            setStatusPendingId(null)
            if (context?.previous) {
                queryClient.setQueryData(
                    ['events', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            setStatusPendingId(null)
            queryClient.invalidateQueries({
                queryKey: ['events', customerId]
            })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (event: CustomerEvent) => {
            const res = await fetch(
                `/api/customers/${customerId}/events/${event.id}`,
                { method: 'DELETE' }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete event')
            }
            return res.json()
        },
        onMutate: async (event) => {
            setStatusPendingId(event.id)
            await queryClient.cancelQueries({
                queryKey: ['events', customerId]
            })
            const previous = queryClient.getQueryData<CustomerEvent[]>([
                'events',
                customerId
            ])
            queryClient.setQueryData<CustomerEvent[]>(
                ['events', customerId],
                (old) => old?.filter((e) => e.id !== event.id) ?? []
            )
            return { previous }
        },
        onError: (error: Error, _variables, context) => {
            setStatusPendingId(null)
            if (context?.previous) {
                queryClient.setQueryData(
                    ['events', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            setStatusPendingId(null)
            queryClient.invalidateQueries({
                queryKey: ['events', customerId]
            })
        }
    })

    const canDelete = (event: CustomerEvent) =>
        isAdmin || (session?.user?.id != null && event.userId === session.user.id)

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <CalendarClock
                        size={16}
                        className='text-muted-foreground'
                    />
                    <span className='flex-1'>Eventos</span>
                    <CreateEventButton customerId={customerId} />
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <GlobeLoader
                        fullScreen={false}
                        className='py-6'
                        size={80}
                        label='Cargando'
                    />
                ) : events.length === 0 ? (
                    <p className='py-4 text-center text-sm text-muted-foreground'>
                        Sin eventos todavía.
                    </p>
                ) : (
                    <div className='space-y-3'>
                        {events.map((event) => (
                            <EventItem
                                key={event.id}
                                event={event}
                                onStatusChange={(ev, status) =>
                                    statusMutation.mutate({
                                        event: ev,
                                        status
                                    })
                                }
                                onEdit={setEditingEvent}
                                onDelete={(ev) => deleteMutation.mutate(ev)}
                                isUpdatingStatus={
                                    statusMutation.isPending &&
                                    statusPendingId === event.id
                                }
                                canManage={canDelete(event)}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
            {editingEvent && (
                <EditEventDialog
                    customerId={customerId}
                    event={editingEvent}
                    open
                    onOpenChange={(open) => {
                        if (!open) setEditingEvent(null)
                    }}
                />
            )}
        </Card>
    )
}