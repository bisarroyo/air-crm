import { MapPin, MessagesSquare, type LucideIcon, Video } from 'lucide-react'

export type EventType = 'videollamada' | 'charla' | 'presencial'
export type EventStatus = 'pending' | 'attended' | 'no_show'

export interface CustomerEvent {
    id: number
    type: EventType
    title: string | null
    scheduledAt: string | null
    status: EventStatus
    meetingLink: string | null
    createdAt: string | null
    userId: string | null
    userName: string | null
    userEmail: string | null
}

export const EVENT_TYPE_META: Record<
    EventType,
    { label: string; icon: LucideIcon; badge: string }
> = {
    videollamada: {
        label: 'Videollamada',
        icon: Video,
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    },
    charla: {
        label: 'Charla',
        icon: MessagesSquare,
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    },
    presencial: {
        label: 'Cita presencial',
        icon: MapPin,
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    }
}

export const EVENT_STATUS_META: Record<
    EventStatus,
    { label: string; badge: string }
> = {
    pending: {
        label: 'Pendiente',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    },
    attended: {
        label: 'Asistió',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    },
    no_show: {
        label: 'No asistió',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
}

export function toDateTimeLocalValue(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatScheduledAt(value: string | null) {
    if (!value) return 'Sin fecha programada'
    return new Date(value).toLocaleString('es', {
        dateStyle: 'full',
        timeStyle: 'short'
    })
}

export function normalizeMeetingLink(link: string) {
    const trimmed = link.trim()
    if (!trimmed) return ''
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}