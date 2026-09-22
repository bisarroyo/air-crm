export interface DashboardEvent {
    id: number
    customerId: number
    customerName: string
    type: 'videollamada' | 'charla' | 'presencial'
    title: string | null
    scheduledAt: string | null
    status: 'pending' | 'attended' | 'no_show'
    meetingLink: string | null
}

export interface DashboardTask {
    id: number
    customerId: number
    customerName: string
    title: string
    description: string | null
    dueDate: string | null
    urgency: 'low' | 'medium' | 'high'
    isCompleted: boolean
}

export function dayKey(date: Date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

export function isDueToday(dueDate: Date) {
    return dayKey(dueDate) === dayKey(startOfToday())
}

export function isOverdue(dueDate: Date) {
    return dueDate.getTime() < startOfToday().getTime()
}

export function dueRelativeLabel(dueDate: Date) {
    if (isOverdue(dueDate)) {
        const days = Math.round(
            (startOfToday().getTime() - dueDate.getTime()) / 86400000
        )
        return days <= 1 ? 'Venci ayer' : `Venció hace ${days} días`
    }
    if (isDueToday(dueDate)) return 'Para hoy'
    return dueDate.toLocaleDateString('es', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    })
}