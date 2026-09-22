'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    EVENT_STATUS_META,
    EVENT_TYPE_META
} from '@/components/events/shared'
import { dayKey, type DashboardEvent } from './shared'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function EventCalendar({ events }: { events: DashboardEvent[] }) {
    const [cursor, setCursor] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [selected, setSelected] = useState(() => startOfToday())

    const byDay = useMemo(() => {
        const map = new Map<string, DashboardEvent[]>()
        for (const ev of events) {
            if (!ev.scheduledAt) continue
            const d = new Date(ev.scheduledAt)
            const k = dayKey(d)
            const arr = map.get(k) ?? []
            arr.push(ev)
            map.set(k, arr)
        }
        return map
    }, [events])

    const cells = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
        const start = new Date(first)
        start.setDate(first.getDate() - first.getDay())
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start)
            d.setDate(start.getDate() + i)
            return d
        })
    }, [cursor])

    const today = startOfToday()
    const monthLabel = cursor.toLocaleDateString('es', {
        month: 'long',
        year: 'numeric'
    })
    const selectedEvents = byDay.get(dayKey(selected)) ?? []
    const selectedLabel = selected.toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    })

    const goToToday = () => {
        const now = new Date()
        setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
        setSelected(now)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center justify-between gap-2'>
                    <span>Calendario de eventos</span>
                    <div className='flex items-center gap-1'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={goToToday}>
                            Hoy
                        </Button>
                        <Button
                            variant='ghost'
                            size='icon-sm'
                            aria-label='Mes anterior'
                            onClick={() =>
                                setCursor(
                                    (prev) =>
                                        new Date(
                                            prev.getFullYear(),
                                            prev.getMonth() - 1,
                                            1
                                        )
                                )
                            }>
                            <ChevronLeft size={16} />
                        </Button>
                        <Button
                            variant='ghost'
                            size='icon-sm'
                            aria-label='Mes siguiente'
                            onClick={() =>
                                setCursor(
                                    (prev) =>
                                        new Date(
                                            prev.getFullYear(),
                                            prev.getMonth() + 1,
                                            1
                                        )
                                )
                            }>
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </CardTitle>
                <p className='text-sm text-muted-foreground capitalize'>
                    {monthLabel}
                </p>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-7 gap-1 text-center'>
                    {WEEKDAYS.map((d) => (
                        <span
                            key={d}
                            className='py-1 text-xs font-medium text-muted-foreground'>
                            {d}
                        </span>
                    ))}
                    {cells.map((day) => {
                        const inMonth =
                            day.getMonth() === cursor.getMonth()
                        const isToday = dayKey(day) === dayKey(today)
                        const isSelected = dayKey(day) === dayKey(selected)
                        const dayEvents = byDay.get(dayKey(day)) ?? []
                        return (
                            <button
                                key={dayKey(day)}
                                type='button'
                                onClick={() => setSelected(day)}
                                className={cn(
                                    'flex min-h-14 flex-col items-center gap-1 rounded-lg border p-1 text-sm transition-colors',
                                    inMonth
                                        ? 'border-border/40 hover:bg-muted'
                                        : 'border-transparent text-muted-foreground/50 hover:bg-muted/50',
                                    isSelected &&
                                        'ring-2 ring-primary/60 hover:bg-muted',
                                    isToday &&
                                        !isSelected &&
                                        'border-primary/50 bg-primary/5'
                                )}>
                                <span
                                    className={cn(
                                        'text-xs font-medium',
                                        isToday &&
                                            'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'
                                    )}>
                                    {day.getDate()}
                                </span>
                                {dayEvents.length > 0 && (
                                    <span className='flex items-center gap-0.5'>
                                        {dayEvents
                                            .slice(0, 4)
                                            .map((ev) => (
                                                <span
                                                    key={ev.id}
                                                    className='size-1.5 rounded-full'
                                                    style={{
                                                        backgroundColor:
                                                            dotColor(ev.type)
                                                    }}
                                                />
                                            ))}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className='mt-4 rounded-lg border border-border/60 bg-muted/40 p-3'>
                    <p className='mb-2 text-xs font-medium text-muted-foreground capitalize'>
                        {selectedLabel}
                    </p>
                    {selectedEvents.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            Sin eventos este día.
                        </p>
                    ) : (
                        <ul className='space-y-2'>
                            {selectedEvents.map((ev) => {
                                const meta = EVENT_TYPE_META[ev.type]
                                const Icon = meta.icon
                                const statusMeta =
                                    EVENT_STATUS_META[ev.status]
                                const time = new Date(
                                    ev.scheduledAt as string
                                ).toLocaleTimeString('es', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })
                                return (
                                    <li
                                        key={ev.id}
                                        className='flex flex-wrap items-center gap-2 text-sm'>
                                        <span className='w-12 font-medium tabular-nums'>
                                            {time}
                                        </span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                                meta.badge
                                            )}>
                                            <Icon size={11} />
                                            {meta.label}
                                        </span>
                                        <Link
                                            href={`/customers/${ev.customerId}`}
                                            className='min-w-0 flex-1 truncate font-medium hover:underline'>
                                            {ev.customerName}
                                        </Link>
                                        {ev.title && (
                                            <span className='text-muted-foreground'>
                                                {ev.title}
                                            </span>
                                        )}
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                                statusMeta.badge
                                            )}>
                                            {statusMeta.label}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

function dotColor(type: DashboardEvent['type']) {
    switch (type) {
        case 'videollamada':
            return '#3b82f6'
        case 'charla':
            return '#8b5cf6'
        case 'presencial':
            return '#10b981'
    }
}