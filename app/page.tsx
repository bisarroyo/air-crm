'use client'

import { useQuery } from '@tanstack/react-query'
import {
    AlertTriangle,
    Bell,
    CalendarClock
} from 'lucide-react'
import { useMemo } from 'react'
import { cn } from 'cn'

import { Card, CardContent } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { EventCalendar } from '@/components/dashboard/calendar'
import { TasksPanel } from '@/components/dashboard/tasks-panel'
import { dayKey, startOfToday, type DashboardEvent, type DashboardTask } from '@/components/dashboard/shared'

function StatCard({
    icon,
    label,
    count,
    tone
}: {
    icon: React.ReactNode
    label: string
    count: number
    tone: 'red' | 'amber' | 'blue'
}) {
    const toneClasses = {
        red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        amber:
            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }[tone]
    return (
        <Card>
            <CardContent className='flex items-center gap-3'>
                <span
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl',
                        toneClasses
                    )}>
                    {icon}
                </span>
                <div>
                    <p className='text-2xl leading-tight font-semibold'>
                        {count}
                    </p>
                    <p className='text-sm text-muted-foreground'>{label}</p>
                </div>
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const { data: events = [], isLoading: eventsLoading } = useQuery<
        DashboardEvent[]
    >({
        queryKey: ['dashboard-events'],
        queryFn: async () => {
            const res = await fetch('/api/events')
            if (!res.ok) throw new Error('Failed to fetch events')
            return res.json()
        }
    })

    const { data: tasks = [], isLoading: tasksLoading } = useQuery<
        DashboardTask[]
    >({
        queryKey: ['dashboard-tasks'],
        queryFn: async () => {
            const res = await fetch('/api/tasks')
            if (!res.ok) throw new Error('Failed to fetch tasks')
            return res.json()
        }
    })

    const counts = useMemo(() => {
        const pendingTasks = tasks.filter((t) => !t.isCompleted)
        const overdue = pendingTasks.filter(
            (t) => t.dueDate && dayKey(new Date(t.dueDate)) < dayKey(startOfToday())
        ).length
        const todayTasks = pendingTasks.filter(
            (t) => t.dueDate && dayKey(new Date(t.dueDate)) === dayKey(startOfToday())
        ).length
        const eventsToday = events.filter(
            (e) =>
                e.scheduledAt &&
                dayKey(new Date(e.scheduledAt)) === dayKey(startOfToday())
        ).length
        return { overdue, todayTasks, eventsToday }
    }, [events, tasks])

    const loading = eventsLoading || tasksLoading

    return (
        <div className='container mx-auto p-6'>
            <div className='mb-6'>
                <h1 className='text-xl font-medium'>Dashboard</h1>
                <p className='text-sm text-muted-foreground'>
                    Eventos, tareas pendientes y notificaciones del día.
                </p>
            </div>

            {loading ? (
                <GlobeLoader fullScreen={false} className='py-32' />
            ) : (
                <div className='space-y-6'>
                    <div className='grid gap-4 sm:grid-cols-3'>
                        <StatCard
                            icon={<AlertTriangle size={18} />}
                            label='Tareas vencidas'
                            count={counts.overdue}
                            tone={counts.overdue > 0 ? 'red' : 'blue'}
                        />
                        <StatCard
                            icon={<Bell size={18} />}
                            label='Tareas para hoy'
                            count={counts.todayTasks}
                            tone={
                                counts.todayTasks > 0 ? 'amber' : 'blue'
                            }
                        />
                        <StatCard
                            icon={<CalendarClock size={18} />}
                            label='Eventos hoy'
                            count={counts.eventsToday}
                            tone={
                                counts.eventsToday > 0 ? 'blue' : 'blue'
                            }
                        />
                    </div>

                    <div className='grid gap-6 lg:grid-cols-3'>
                        <div className='lg:col-span-2'>
                            <EventCalendar events={events} />
                        </div>
                        <TasksPanel tasks={tasks} />
                    </div>
                </div>
            )}
        </div>
    )
}