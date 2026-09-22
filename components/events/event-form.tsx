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
import { type EventType, normalizeMeetingLink } from './shared'

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

function EventForm({
    customerId,
    onDone
}: {
    customerId: number
    onDone: () => void
}) {
    const queryClient = useQueryClient()

    const [type, setType] = useState<EventType>('charla')
    const [title, setTitle] = useState('')
    const [scheduledDate, setScheduledDate] = useState(defaultScheduledAtDate())
    const [scheduledTime, setScheduledTime] = useState(defaultScheduledAtTime())
    const [meetingLink, setMeetingLink] = useState('')

    const mutation = useMutation({
        mutationFn: async () => {
            let scheduledAt: string | null = null
            if (scheduledDate && scheduledTime) {
                const dateTime = new Date(`${scheduledDate}T${scheduledTime}`)
                scheduledAt = dateTime.toISOString()
            }
            const res = await fetch(`/api/customers/${customerId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title,
                    scheduledAt,
                    meetingLink: normalizeMeetingLink(meetingLink)
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create event')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Evento creado')
            onDone()
            queryClient.invalidateQueries({
                queryKey: ['events', customerId]
            })
        },
        onError: (error: Error) => toast.error(error.message)
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
