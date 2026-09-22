'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    Bell,
    CalendarClock,
    Loader2,
    Pencil,
    Plus,
    StickyNote,
    Trash2
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip'
import { DatePicker } from '@/components/ui/date-picker'
import { useSession } from '@/hooks/use-session'
import { cn } from 'cn'

interface Note {
    id: number
    note: string
    createdAt: string | null
    userId: string | null
    userName: string | null
    userEmail: string | null
}

interface Task {
    id: number
    title: string
    description: string | null
    dueDate: string | null
    urgency: 'low' | 'medium' | 'high'
    isCompleted: boolean
    completedAt: string | null
    createdAt: string | null
    userId: string | null
    userName: string | null
    userEmail: string | null
}

const URGENCY_META: Record<Task['urgency'], { label: string; badge: string }> =
    {
        high: {
            label: 'Alta',
            badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        },
        medium: {
            label: 'Media',
            badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        },
        low: {
            label: 'Baja',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        }
    }

function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

function isDueToday(dueDate: Date) {
    const today = startOfToday()
    return (
        dueDate.getFullYear() === today.getFullYear() &&
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getDate() === today.getDate()
    )
}

function isOverdue(dueDate: Date) {
    return dueDate.getTime() < startOfToday().getTime()
}

function localizedDate(dueDate: Date) {
    return new Date(dueDate).toLocaleDateString('es', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    })
}

function fromDateInputValue(value: string) {
    if (!value) return null
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
}

function toDateInputValue(value: string | null) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function NoteEditDialog({
    customerId,
    note,
    open,
    onOpenChange
}: {
    customerId: number
    note: Note
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const queryClient = useQueryClient()
    const [text, setText] = useState(note.note)

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(
                `/api/customers/${customerId}/notes/${note.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ note: text.trim() })
                }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update note')
            }
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ['notes', customerId]
            })
            const previous = queryClient.getQueryData<Note[]>([
                'notes',
                customerId
            ])
            queryClient.setQueryData<Note[]>(['notes', customerId], (old) =>
                old?.map((n) =>
                    n.id === note.id ? { ...n, note: text.trim() } : n
                ) ?? []
            )
            return { previous }
        },
        onSuccess: () => {
            toast.success('Nota actualizada')
            onOpenChange(false)
        },
        onError: (error: Error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    ['notes', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <StickyNote
                            size={16}
                            className='text-muted-foreground'
                        />
                        Editar nota
                    </DialogTitle>
                    <DialogDescription>
                        Actualiza el contenido de la nota.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (text.trim()) mutation.mutate()
                    }}
                    className='grid gap-4'>
                    <Field>
                        <FieldLabel>Contenido</FieldLabel>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={4}
                            autoFocus
                            className='w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
                        />
                    </Field>
                    <div className='flex justify-end gap-2 pt-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type='submit'
                            disabled={!text.trim() || mutation.isPending}>
                            {mutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
                            ) : (
                                'Guardar cambios'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function NoteCard({ customerId }: { customerId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [noteText, setNoteText] = useState('')
    const [pendingId, setPendingId] = useState<number | null>(null)
    const [editingNote, setEditingNote] = useState<Note | null>(null)

    const { data: notes = [], isLoading } = useQuery<Note[]>({
        queryKey: ['notes', customerId],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/notes`)
            if (!res.ok) throw new Error('Failed to fetch notes')
            return res.json()
        }
    })

    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: noteText })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to add note')
            }
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ['notes', customerId]
            })
            const previous = queryClient.getQueryData<Note[]>([
                'notes',
                customerId
            ])
            const optimistic: Note = {
                id: -Date.now(),
                note: noteText.trim(),
                createdAt: new Date().toISOString(),
                userId: session?.user?.id ?? null,
                userName: session?.user?.name ?? null,
                userEmail: session?.user?.email ?? null
            }
            queryClient.setQueryData<Note[]>(['notes', customerId], (old) => [
                optimistic,
                ...(old ?? [])
            ])
            return { previous }
        },
        onSuccess: () => {
            setNoteText('')
        },
        onError: (error: Error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    ['notes', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (noteId: number) => {
            const res = await fetch(
                `/api/customers/${customerId}/notes/${noteId}`,
                { method: 'DELETE' }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete note')
            }
            return res.json()
        },
        onMutate: async (noteId) => {
            setPendingId(noteId)
            await queryClient.cancelQueries({
                queryKey: ['notes', customerId]
            })
            const previous = queryClient.getQueryData<Note[]>([
                'notes',
                customerId
            ])
            queryClient.setQueryData<Note[]>(['notes', customerId], (old) =>
                old?.filter((n) => n.id !== noteId) ?? []
            )
            return { previous }
        },
        onError: (error: Error, _variables, context) => {
            setPendingId(null)
            if (context?.previous) {
                queryClient.setQueryData(
                    ['notes', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            setPendingId(null)
            queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
        }
    })

    const canDelete = (note: Note) =>
        isAdmin ||
        (session?.user?.id != null && note.userId === session.user.id)

    return (
        <Card className='h-fit'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <StickyNote size={16} className='text-muted-foreground' />
                    Notas
                </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (noteText.trim()) addMutation.mutate()
                    }}
                    className='flex flex-col gap-2'>
                    <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder='Escribe un comentario...'
                        rows={3}
                        className='w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
                    />
                    <div className='flex justify-end'>
                        <Button
                            type='submit'
                            size='sm'
                            disabled={
                                !noteText.trim() || addMutation.isPending
                            }>
                            {addMutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
                            ) : (
                                <Plus size={14} />
                            )}
                            Agregar
                        </Button>
                    </div>
                </form>

                {isLoading ? (
                    <GlobeLoader
                        fullScreen={false}
                        className='py-6'
                        size={80}
                        label='Cargando'
                    />
                ) : notes.length === 0 ? (
                    <p className='py-4 text-center text-sm text-muted-foreground'>
                        Sin notas todavía.
                    </p>
                ) : (
                    <div className='max-h-96 space-y-3 overflow-y-auto pr-1'>
                        {notes.map((note) => (
                            <div
                                key={note.id}
                                className='rounded-lg border border-border/60 bg-muted/40 p-3 text-sm'>
                                <p className='whitespace-pre-wrap break-words'>
                                    {note.note}
                                </p>
                                <div className='mt-2 flex items-center justify-between gap-2'>
                                    <span className='text-xs text-muted-foreground'>
                                        {note.userName || note.userEmail || '—'}
                                        {note.createdAt && (
                                            <>
                                                {' · '}
                                                {new Date(
                                                    note.createdAt
                                                ).toLocaleString('es', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </>
                                        )}
                                    </span>
                                    {canDelete(note) && (
                                        <>
                                            <Button
                                                variant='ghost'
                                                size='icon-xs'
                                                aria-label='Editar nota'
                                                title='Editar nota'
                                                onClick={() =>
                                                    setEditingNote(note)
                                                }
                                                disabled={
                                                    deleteMutation.isPending &&
                                                    pendingId === note.id
                                                }>
                                                <Pencil size={12} />
                                            </Button>
                                            <Button
                                                variant='ghost'
                                                size='icon-xs'
                                                aria-label='Eliminar nota'
                                                onClick={() =>
                                                    deleteMutation.mutate(
                                                        note.id
                                                    )
                                                }
                                                disabled={
                                                    deleteMutation.isPending &&
                                                    pendingId === note.id
                                                }>
                                                {deleteMutation.isPending &&
                                                pendingId === note.id ? (
                                                    <Loader2
                                                        size={12}
                                                        className='animate-spin'
                                                    />
                                                ) : (
                                                    <Trash2 size={12} />
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            {editingNote && (
                <NoteEditDialog
                    customerId={customerId}
                    note={editingNote}
                    open
                    onOpenChange={(open) => {
                        if (!open) setEditingNote(null)
                    }}
                />
            )}
        </Card>
    )
}

function TaskBadge({ tasks }: { tasks: Task[] }) {
    const pending = tasks.filter((t) => !t.isCompleted)
    const dueTodayCount = pending.filter(
        (t) => t.dueDate && isDueToday(new Date(t.dueDate))
    ).length
    const overdueCount = pending.filter(
        (t) => t.dueDate && isOverdue(new Date(t.dueDate))
    ).length
    const total = dueTodayCount + overdueCount

    if (total === 0) return null

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        className={cn(
                            'inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-white',
                            overdueCount > 0 ? 'bg-red-500' : 'bg-amber-500'
                        )}>
                        {overdueCount > 0 ? (
                            <AlertTriangle size={12} />
                        ) : (
                            <Bell size={12} />
                        )}
                        {overdueCount > 0 ? overdueCount : dueTodayCount}
                    </span>
                }
            />
            <TooltipContent>
                {overdueCount} vencida{overdueCount !== 1 && 's'} ·{' '}
                {dueTodayCount} para hoy
            </TooltipContent>
        </Tooltip>
    )
}

function formatDueDate(dueDate: Date) {
    if (isOverdue(dueDate)) {
        return (
            <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                <CalendarClock size={11} />
                Vencida · {localizedDate(dueDate)}
            </span>
        )
    }
    if (isDueToday(dueDate)) {
        return (
            <span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'>
                <CalendarClock size={11} />
                Hoy
            </span>
        )
    }
    const dueLabel = `Vence ${localizedDate(dueDate)}`
    return (
        <span className='inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'>
            <CalendarClock size={11} />
            {dueLabel}
        </span>
    )
}

function TaskEditDialog({
    customerId,
    task,
    open,
    onOpenChange
}: {
    customerId: number
    task: Task
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const queryClient = useQueryClient()
    const [title, setTitle] = useState(task.title)
    const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate))
    const [urgency, setUrgency] = useState<Task['urgency']>(task.urgency)

    const mutation = useMutation({
        mutationFn: async () => {
            const date = fromDateInputValue(dueDate)
            const res = await fetch(
                `/api/customers/${customerId}/tasks/${task.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        dueDate: date ? date.toISOString() : null,
                        urgency
                    })
                }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update task')
            }
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ['tasks', customerId]
            })
            const previous = queryClient.getQueryData<Task[]>([
                'tasks',
                customerId
            ])
            const date = fromDateInputValue(dueDate)
            queryClient.setQueryData<Task[]>(['tasks', customerId], (old) =>
                old?.map((t) =>
                    t.id === task.id
                        ? {
                              ...t,
                              title: title.trim(),
                              dueDate: date ? date.toISOString() : null,
                              urgency
                          }
                        : t
                ) ?? []
            )
            return { previous }
        },
        onSuccess: () => {
            toast.success('Tarea actualizada')
            onOpenChange(false)
        },
        onError: (error: Error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    ['tasks', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <CalendarClock
                            size={16}
                            className='text-muted-foreground'
                        />
                        Editar tarea
                    </DialogTitle>
                    <DialogDescription>
                        Actualiza los detalles de la tarea.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (title.trim())
                            mutation.mutate()
                    }}
                    className='grid gap-4'>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Título</FieldLabel>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder='Título de la tarea'
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Fecha de vencimiento</FieldLabel>
                            <DatePicker
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder='Fecha de vencimiento'
                                aria-label='Fecha de vencimiento'
                                className='w-full'
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Urgencia</FieldLabel>
                            <Select
                                value={urgency}
                                onValueChange={(value) =>
                                    setUrgency(value as Task['urgency'])
                                }>
                                <SelectTrigger className='w-full'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value='high'>
                                            Alta
                                        </SelectItem>
                                        <SelectItem value='medium'>
                                            Media
                                        </SelectItem>
                                        <SelectItem value='low'>
                                            Baja
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                    </FieldGroup>
                    <div className='flex justify-end gap-2 pt-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type='submit'
                            disabled={!title.trim() || mutation.isPending}>
                            {mutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
                            ) : (
                                'Guardar cambios'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function TaskCard({ customerId }: { customerId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [title, setTitle] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [urgency, setUrgency] = useState<Task['urgency']>('medium')
    const [pendingToggleId, setPendingToggleId] = useState<number | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
    const [editingTask, setEditingTask] = useState<Task | null>(null)

    const { data: tasks = [], isLoading } = useQuery<Task[]>({
        queryKey: ['tasks', customerId],
        queryFn: async () => {
            const res = await fetch(`/api/customers/${customerId}/tasks`)
            if (!res.ok) throw new Error('Failed to fetch tasks')
            return res.json()
        }
    })

    const addMutation = useMutation({
        mutationFn: async () => {
            const date = fromDateInputValue(dueDate)
            const res = await fetch(`/api/customers/${customerId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    dueDate: date ? date.toISOString() : null,
                    urgency
                })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to add task')
            }
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ['tasks', customerId]
            })
            const previous = queryClient.getQueryData<Task[]>([
                'tasks',
                customerId
            ])
            const date = fromDateInputValue(dueDate)
            const optimistic: Task = {
                id: -Date.now(),
                title: title.trim(),
                description: null,
                dueDate: date ? date.toISOString() : null,
                urgency,
                isCompleted: false,
                completedAt: null,
                createdAt: new Date().toISOString(),
                userId: session?.user?.id ?? null,
                userName: session?.user?.name ?? null,
                userEmail: session?.user?.email ?? null
            }
            queryClient.setQueryData<Task[]>(['tasks', customerId], (old) => [
                optimistic,
                ...(old ?? [])
            ])
            return { previous }
        },
        onSuccess: () => {
            setTitle('')
            setDueDate('')
            setUrgency('medium')
        },
        onError: (error: Error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    ['tasks', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        }
    })

    const toggleMutation = useMutation({
        mutationFn: async (task: Task) => {
            const res = await fetch(
                `/api/customers/${customerId}/tasks/${task.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isCompleted: !task.isCompleted })
                }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update task')
            }
            return res.json()
        },
        onMutate: async (task) => {
            setPendingToggleId(task.id)
            await queryClient.cancelQueries({
                queryKey: ['tasks', customerId]
            })
            const previous = queryClient.getQueryData<Task[]>([
                'tasks',
                customerId
            ])
            queryClient.setQueryData<Task[]>(['tasks', customerId], (old) =>
                old?.map((t) =>
                    t.id === task.id
                        ? {
                              ...t,
                              isCompleted: !t.isCompleted,
                              completedAt: !t.isCompleted
                                  ? new Date().toISOString()
                                  : null
                          }
                        : t
                ) ?? []
            )
            return { previous }
        },
        onError: (error: Error, _variables, context) => {
            setPendingToggleId(null)
            if (context?.previous) {
                queryClient.setQueryData(
                    ['tasks', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            setPendingToggleId(null)
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (taskId: number) => {
            const res = await fetch(
                `/api/customers/${customerId}/tasks/${taskId}`,
                { method: 'DELETE' }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to delete task')
            }
            return res.json()
        },
        onMutate: async (taskId) => {
            setPendingDeleteId(taskId)
            await queryClient.cancelQueries({
                queryKey: ['tasks', customerId]
            })
            const previous = queryClient.getQueryData<Task[]>([
                'tasks',
                customerId
            ])
            queryClient.setQueryData<Task[]>(['tasks', customerId], (old) =>
                old?.filter((t) => t.id !== taskId) ?? []
            )
            return { previous }
        },
        onError: (error: Error, _variables, context) => {
            setPendingDeleteId(null)
            if (context?.previous) {
                queryClient.setQueryData(
                    ['tasks', customerId],
                    context.previous
                )
            }
            toast.error(error.message)
        },
        onSettled: () => {
            setPendingDeleteId(null)
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        }
    })

    const canDelete = (task: Task) =>
        isAdmin ||
        (session?.user?.id != null && task.userId === session.user.id)

    return (
        <Card className='h-fit'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <span className='flex flex-1 items-center gap-2'>
                        <CalendarClock
                            size={16}
                            className='text-muted-foreground'
                        />
                        Tareas
                    </span>
                    <TaskBadge tasks={tasks} />
                </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (title.trim()) addMutation.mutate()
                    }}
                    className='grid gap-2'>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder='Nueva tarea...'
                        aria-label='Título de la tarea'
                    />
                    <div className='grid grid-cols-2 gap-2'>
                        <DatePicker
                            value={dueDate}
                            onChange={setDueDate}
                            placeholder='Fecha de vencimiento'
                            aria-label='Fecha de vencimiento'
                            className='w-full'
                        />
                        <Select
                            value={urgency}
                            onValueChange={(value) =>
                                setUrgency(value as Task['urgency'])
                            }>
                            <SelectTrigger
                                aria-label='Urgencia'
                                className='w-full'>
                                <SelectValue className='w-full' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value='high'>Alta</SelectItem>
                                    <SelectItem value='medium'>
                                        Media
                                    </SelectItem>
                                    <SelectItem value='low'>Baja</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='flex justify-end'>
                        <Button
                            type='submit'
                            size='sm'
                            disabled={!title.trim() || addMutation.isPending}>
                            {addMutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
                            ) : (
                                <Plus size={14} />
                            )}
                            Agregar tarea
                        </Button>
                    </div>
                </form>

                {isLoading ? (
                    <GlobeLoader
                        fullScreen={false}
                        className='py-6'
                        size={80}
                        label='Cargando'
                    />
                ) : tasks.length === 0 ? (
                    <p className='py-4 text-center text-sm text-muted-foreground'>
                        Sin tareas todavía.
                    </p>
                ) : (
                    <div className='max-h-96 space-y-2 overflow-y-auto pr-1'>
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={cn(
                                    'flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm transition-colors',
                                    task.isCompleted && 'opacity-60'
                                )}>
                                <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={() =>
                                        toggleMutation.mutate(task)
                                    }
                                    disabled={
                                        toggleMutation.isPending &&
                                        pendingToggleId === task.id
                                    }
                                    aria-label={`Marcar tarea ${task.isCompleted ? 'incompleta' : 'completa'}`}
                                    className='mt-0.5'
                                />
                                <div className='flex flex-1 flex-col gap-1'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <span
                                            className={cn(
                                                'font-medium',
                                                task.isCompleted &&
                                                    'text-muted-foreground line-through'
                                            )}>
                                            {task.title}
                                        </span>
                                        <div className='flex shrink-0 items-center gap-1.5'>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                                    URGENCY_META[task.urgency]
                                                        ?.badge
                                                )}>
                                                {URGENCY_META[task.urgency]
                                                    ?.label || task.urgency}
                                            </span>
                                            {canDelete(task) && (
                                                <>
                                                    <Button
                                                        variant='ghost'
                                                        size='icon-xs'
                                                        aria-label='Editar tarea'
                                                        title='Editar tarea'
                                                        onClick={() =>
                                                            setEditingTask(
                                                                task
                                                            )
                                                        }
                                                        disabled={
                                                            deleteMutation.isPending &&
                                                            pendingDeleteId ===
                                                                task.id
                                                        }>
                                                        <Pencil size={12} />
                                                    </Button>
                                                    <Button
                                                        variant='ghost'
                                                        size='icon-xs'
                                                        aria-label='Eliminar tarea'
                                                        onClick={() =>
                                                            deleteMutation.mutate(
                                                                task.id
                                                            )
                                                        }
                                                        disabled={
                                                            deleteMutation.isPending &&
                                                            pendingDeleteId ===
                                                                task.id
                                                        }>
                                                        {deleteMutation.isPending &&
                                                        pendingDeleteId ===
                                                            task.id ? (
                                                            <Loader2
                                                                size={12}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <Trash2 size={12} />
                                                        )}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {task.description && (
                                        <p className='text-xs text-muted-foreground'>
                                            {task.description}
                                        </p>
                                    )}
                                    <div className='mt-1 flex flex-wrap items-center gap-2'>
                                        {task.dueDate &&
                                            formatDueDate(
                                                new Date(task.dueDate)
                                            )}
                                        {task.createdAt && (
                                            <span className='text-xs text-muted-foreground'>
                                                {task.userName ||
                                                    task.userEmail ||
                                                    '—'}
                                                {' · '}
                                                {new Date(
                                                    task.createdAt
                                                ).toLocaleDateString('es', {
                                                    dateStyle: 'short'
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            {editingTask && (
                <TaskEditDialog
                    customerId={customerId}
                    task={editingTask}
                    open
                    onOpenChange={(open) => {
                        if (!open) setEditingTask(null)
                    }}
                />
            )}
        </Card>
    )
}

export function CustomerNotesTasks({ customerId }: { customerId: number }) {
    return (
        <div className=' grid gap-6 md:grid-cols-2'>
            <NoteCard customerId={customerId} />
            <TaskCard customerId={customerId} />
        </div>
    )
}
