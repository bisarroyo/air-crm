'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    Bell,
    CalendarClock,
    Loader2,
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

function NoteCard({ customerId }: { customerId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [noteText, setNoteText] = useState('')
    const [pendingId, setPendingId] = useState<number | null>(null)

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
        onSuccess: () => {
            setNoteText('')
            queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
        },
        onError: (error: Error) => toast.error(error.message)
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
        onMutate: (noteId) => setPendingId(noteId),
        onSuccess: () => {
            setPendingId(null)
            queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
        },
        onError: (error: Error) => {
            setPendingId(null)
            toast.error(error.message)
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
                                        <Button
                                            variant='ghost'
                                            size='icon-xs'
                                            aria-label='Eliminar nota'
                                            onClick={() =>
                                                deleteMutation.mutate(note.id)
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
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

function TaskCard({ customerId }: { customerId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [title, setTitle] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [urgency, setUrgency] = useState<Task['urgency']>('medium')
    const [pendingToggleId, setPendingToggleId] = useState<number | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

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
        onSuccess: () => {
            setTitle('')
            setDueDate('')
            setUrgency('medium')
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        },
        onError: (error: Error) => toast.error(error.message)
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
        onMutate: (task) => setPendingToggleId(task.id),
        onSuccess: () => {
            setPendingToggleId(null)
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        },
        onError: (error: Error) => {
            setPendingToggleId(null)
            toast.error(error.message)
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
        onMutate: (taskId) => setPendingDeleteId(taskId),
        onSuccess: () => {
            setPendingDeleteId(null)
            queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
        },
        onError: (error: Error) => {
            setPendingDeleteId(null)
            toast.error(error.message)
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
