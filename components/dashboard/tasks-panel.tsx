'use client'

import { AlertTriangle, Bell, CheckCircle2, ListTodo } from 'lucide-react'
import Link from 'next/link'
import { cn } from 'cn'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isDueToday, isOverdue, type DashboardTask } from './shared'

const URGENCY_META: Record<
    DashboardTask['urgency'],
    { label: string; badge: string }
> = {
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

function TaskRow({ task }: { task: DashboardTask }) {
    const urgency = URGENCY_META[task.urgency]
    return (
        <li className='flex items-start gap-2 py-2'>
            <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-current text-muted-foreground' />
            <div className='min-w-0 flex-1'>
                <p className='text-sm leading-snug'>{task.title}</p>
                <Link
                    href={`/customers/${task.customerId}`}
                    className='text-xs text-muted-foreground hover:underline'>
                    {task.customerName}
                </Link>
            </div>
            <span
                className={cn(
                    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    urgency.badge
                )}>
                {urgency.label}
            </span>
        </li>
    )
}

export function TasksPanel({ tasks }: { tasks: DashboardTask[] }) {
    const overdue = tasks.filter(
        (t) => t.dueDate && isOverdue(new Date(t.dueDate))
    )
    const today = tasks.filter(
        (t) => t.dueDate && isDueToday(new Date(t.dueDate))
    )
    const upcoming = tasks.filter(
        (t) =>
            t.dueDate &&
            !isOverdue(new Date(t.dueDate)) &&
            !isDueToday(new Date(t.dueDate))
    )
    const noDate = tasks.filter((t) => !t.dueDate)

    const overdueCount = overdue.length
    const todayCount = today.length
    const notifTotal = overdueCount + todayCount

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <ListTodo size={16} className='text-muted-foreground' />
                    <span className='flex-1'>Tareas pendientes</span>
                    {notifTotal > 0 && (
                        <span
                            className={cn(
                                'inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-white',
                                overdueCount > 0
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                            )}>
                            {overdueCount > 0 ? (
                                <AlertTriangle size={12} />
                            ) : (
                                <Bell size={12} />
                            )}
                            {notifTotal}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
                {notifTotal > 0 && (
                    <div className='flex flex-wrap gap-2'>
                        <span className='inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            <AlertTriangle size={12} />
                            {overdueCount} vencida{overdueCount !== 1 && 's'}
                        </span>
                        <span className='inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'>
                            <Bell size={12} />
                            {todayCount} para hoy
                        </span>
                    </div>
                )}

                {tasks.length === 0 ? (
                    <div className='flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground'>
                        <CheckCircle2 size={24} />
                        Sin tareas pendientes.
                    </div>
                ) : (
                    <div className='max-h-[540px] space-y-3 overflow-y-auto pr-1'>
                        {overdueCount > 0 && (
                            <div>
                                <p className='text-xs font-semibold text-red-600 uppercase tracking-wider dark:text-red-400'>
                                    Vencidas
                                </p>
                                <ul className='divide-y divide-border/60'>
                                    {overdue.map((t) => (
                                        <TaskRow key={t.id} task={t} />
                                    ))}
                                </ul>
                            </div>
                        )}
                        {todayCount > 0 && (
                            <div>
                                <p className='text-xs font-semibold text-amber-600 uppercase tracking-wider dark:text-amber-400'>
                                    Hoy
                                </p>
                                <ul className='divide-y divide-border/60'>
                                    {today.map((t) => (
                                        <TaskRow key={t.id} task={t} />
                                    ))}
                                </ul>
                            </div>
                        )}
                        {upcoming.length > 0 && (
                            <div>
                                <p className='text-xs font-semibold text-foreground uppercase tracking-wider'>
                                    Próximas
                                </p>
                                <ul className='divide-y divide-border/60'>
                                    {upcoming.map((t) => (
                                        <TaskRow key={t.id} task={t} />
                                    ))}
                                </ul>
                            </div>
                        )}
                        {noDate.length > 0 && (
                            <div>
                                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                                    Sin fecha
                                </p>
                                <ul className='divide-y divide-border/60'>
                                    {noDate.map((t) => (
                                        <TaskRow key={t.id} task={t} />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}