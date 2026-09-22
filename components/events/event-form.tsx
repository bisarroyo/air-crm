import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import {
    type CustomerEvent,
    type EventType,
    normalizeMeetingLink
} from './shared'

const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
    { value: 'videollamada', label: 'Videollamada' },
    { value: 'charla', label: 'Charla' },
    { value: 'presencial', label: 'Cita presencial' }
]

export function CreateEventButton({
    customerId,
    className
}: {
    customerId: number
    className?: string
}) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button
                size='sm'
                onClick={() => setOpen(true)}
                className={className}>
                <Plus size={14} /> Agregar evento
            </Button>
            <CreateEventDialog
                customerId={customerId}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    )
}

function defaultScheduledAtDate() {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 60)
    d.setSeconds(0, 0)
    return d.toISOString().split('T')[0]
}

function defaultScheduledAtTime() {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 60)
    d.setSeconds(0, 0)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
}

function scheduledAtToLocalParts(value: string | null) {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
}

function EventForm({
    customerId,
    event,
    onDone
}: {
    customerId: number
    event?: CustomerEvent
    onDone: () => void
}) {
    const queryClient = useQueryClient()

    const initialParts = event
        ? scheduledAtToLocalParts(event.scheduledAt)
        : null

    const [type, setType] = useState<EventType>(event?.type ?? 'charla')
    const [title, setTitle] = useState(event?.title ?? '')
    const [scheduledDate, setScheduledDate] = useState(
        initialParts?.date ?? defaultScheduledAtDate()
    )
    const [scheduledTime, setScheduledTime] = useState(
        initialParts?.time ?? defaultScheduledAtTime()
    )
    const [meetingLink, setMeetingLink] = useState(event?.meetingLink ?? '')
    const isEditing = event != null

    function buildScheduledAt() {
        if (!scheduledDate || !scheduledTime) return null
        const dateTime = new Date(`${scheduledDate}T${scheduledTime}`)
        if (Number.isNaN(dateTime.getTime())) return null
        return dateTime.toISOString()
    }

    const mutation = useMutation({
        mutationFn: async () => {
            const payload = {
                type,
                title,
                scheduledAt: buildScheduledAt(),
                meetingLink: normalizeMeetingLink(meetingLink)
            }
            const res = await fetch(
                event
                    ? `/api/customers/${customerId}/events/${event.id}`
                    : `/api/customers/${customerId}/events`,
                {
                    method: event ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to save event')
            }
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ['events', customerId]
            })
            const previous = queryClient.getQueryData<CustomerEvent[]>([
                'events',
                customerId
            ])
            const scheduledAt = buildScheduledAt()
            if (event) {
                queryClient.setQueryData<CustomerEvent[]>(
                    ['events', customerId],
                    (old) =>
                        old?.map((e) =>
                            e.id === event.id
                                ? {
                                      ...e,
                                      type,
                                      title,
                                      scheduledAt,
                                      meetingLink:
                                          normalizeMeetingLink(meetingLink) ||
                                          null
                                  }
                                : e
                        ) ?? []
                )
            } else {
                const optimisticEvent: CustomerEvent = {
                    id: -Date.now(),
                    type,
                    title,
                    scheduledAt,
                    status: 'pending',
                    meetingLink: normalizeMeetingLink(meetingLink) || null,
                    createdAt: new Date().toISOString(),
                    userId: null,
                    userName: null,
                    userEmail: null
                }
                queryClient.setQueryData<CustomerEvent[]>(
                    ['events', customerId],
                    (old) => [optimisticEvent, ...(old ?? [])]
                )
            }
            return { previous }
        },
        onSuccess: () => {
            toast.success(isEditing ? 'Evento actualizado' : 'Evento creado')
            onDone()
        },
        onError: (error: Error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    ['events', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['events', customerId] })
        }
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate()
            }}
            className='grid gap-4'>
            <FieldGroup>
                <Field>
                    <FieldLabel>Tipo de evento</FieldLabel>
                    <Select
                        value={type}
                        onValueChange={(v) => setType(v as EventType)}
                        items={EVENT_TYPE_OPTIONS}>
                        <SelectTrigger className='w-full'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value='videollamada'>
                                    Videollamada
                                </SelectItem>
                                <SelectItem value='charla'>Charla</SelectItem>
                                <SelectItem value='presencial'>
                                    Cita presencial
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel>Título (opcional)</FieldLabel>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder='Ej. Llamada inicial de asesoría'
                    />
                </Field>
                <Field>
                    <FieldLabel>Fecha y hora</FieldLabel>
                    <div className='grid grid-cols-2 gap-2'>
                        <DatePicker
                            value={scheduledDate}
                            onChange={setScheduledDate}
                            placeholder='Fecha'
                            aria-label='Fecha del evento'
                            className='w-full'
                        />
                        <TimePicker
                            value={scheduledTime}
                            onChange={setScheduledTime}
                            placeholder='Hora'
                            aria-label='Hora del evento'
                            interval={15}
                            className='w-full'
                        />
                    </div>
                </Field>
                {type === 'videollamada' && (
                    <Field>
                        <FieldLabel>Enlace de la videollamada</FieldLabel>
                        <Input
                            type='text'
                            inputMode='url'
                            autoCapitalize='none'
                            autoCorrect='off'
                            spellCheck={false}
                            value={meetingLink}
                            onChange={(e) => setMeetingLink(e.target.value)}
                            placeholder='meet.google.com/wck-pzwx-ejj'
                        />
                    </Field>
                )}
            </FieldGroup>
            <div className='flex justify-end gap-2 pt-2'>
                <Button type='button' variant='ghost' onClick={onDone}>
                    Cancelar
                </Button>
                <Button type='submit' disabled={mutation.isPending}>
                    {mutation.isPending ? (
                        <Loader2 size={16} className='animate-spin' />
                    ) : isEditing ? (
                        'Guardar cambios'
                    ) : (
                        'Crear evento'
                    )}
                </Button>
            </div>
        </form>
    )
}

export function CreateEventDialog({
    customerId,
    open,
    onOpenChange
}: {
    customerId: number
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <CalendarClock
                            size={16}
                            className='text-muted-foreground'
                        />
                        Nuevo evento
                    </DialogTitle>
                    <DialogDescription>
                        Programa una videollamada, charla o cita presencial.
                    </DialogDescription>
                </DialogHeader>
                <EventForm
                    key={String(open)}
                    customerId={customerId}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}

export function EditEventDialog({
    customerId,
    event,
    open,
    onOpenChange
}: {
    customerId: number
    event: CustomerEvent
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <CalendarClock
                            size={16}
                            className='text-muted-foreground'
                        />
                        Editar evento
                    </DialogTitle>
                    <DialogDescription>
                        Actualiza los detalles del evento.
                    </DialogDescription>
                </DialogHeader>
                <EventForm
                    key={String(open)}
                    customerId={customerId}
                    event={event}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}
