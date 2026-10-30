'use client'

import * as React from 'react'
import { es } from 'react-day-picker/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, ChevronDownIcon, X } from 'lucide-react'

import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover'

export function parseDateValue(
    value?: string | null
): Date | undefined {
    if (!value) return undefined
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return undefined
    const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
    )
    return Number.isNaN(date.getTime()) ? undefined : date
}

export function toDateValue(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function formatShortDate(value?: string | null): string {
    const date = parseDateValue(value)
    if (!date) return ''
    return date.toLocaleDateString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

export function formatDateRange(
    from?: string | null,
    to?: string | null
): string {
    const fromLabel = formatShortDate(from)
    const toLabel = formatShortDate(to)
    if (fromLabel && toLabel) return `${fromLabel} – ${toLabel}`
    if (fromLabel) return `Desde ${fromLabel}`
    if (toLabel) return `Hasta ${toLabel}`
    return ''
}

interface DateRangePickerProps {
    /** Fecha inicial en formato YYYY-MM-DD. */
    from?: string
    /** Fecha final en formato YYYY-MM-DD. */
    to?: string
    onChange?: (from: string, to: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    clearable?: boolean
    /** Texto del botón que cierra el calendario. */
    doneLabel?: string
    /** Se llama cuando el calendario se abre o se cierra. */
    onOpenChange?: (open: boolean) => void
}

export function DateRangePicker({
    from,
    to,
    onChange,
    placeholder = 'Seleccionar rango de fechas',
    className,
    disabled,
    clearable = true,
    doneLabel = 'Listo',
    onOpenChange
}: DateRangePickerProps) {
    const [open, setOpen] = React.useState(false)

    const handleOpenChange = (next: boolean) => {
        setOpen(next)
        onOpenChange?.(next)
    }

    const range = React.useMemo<DateRange>(
        () => ({
            from: parseDateValue(from),
            to: parseDateValue(to)
        }),
        [from, to]
    )

    const label = formatDateRange(from, to)
    const hasValue = Boolean(from || to)

    const handleSelect = (nextRange: DateRange | undefined) => {
        if (!nextRange?.from) {
            onChange?.('', '')
            return
        }
        onChange?.(
            toDateValue(nextRange.from),
            nextRange.to ? toDateValue(nextRange.to) : ''
        )
    }

    return (
        <Popover
            open={open}
            onOpenChange={handleOpenChange}>
            <PopoverTrigger
                render={
                    <Button
                        type='button'
                        variant='outline'
                        disabled={disabled}
                        className={cn(
                            'w-full justify-start gap-2 text-left font-normal',
                            !hasValue && 'text-muted-foreground',
                            className
                        )}
                    />
                }>
                <CalendarIcon className='size-4 shrink-0 opacity-70' />
                <span className='min-w-0 flex-1 truncate'>
                    {hasValue ? label : placeholder}
                </span>
                {clearable && hasValue ? (
                    <span
                        role='button'
                        tabIndex={0}
                        aria-label='Limpiar fechas'
                        className='rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onChange?.('', '')
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                onChange?.('', '')
                            }
                        }}>
                        <X className='size-3.5' />
                    </span>
                ) : (
                    <ChevronDownIcon className='size-4 shrink-0 opacity-70' />
                )}
            </PopoverTrigger>
            <PopoverContent
                align='start'
                className='w-auto gap-0 p-0'
                onClick={(event) => event.stopPropagation()}>
                <Calendar
                    mode='range'
                    selected={range}
                    defaultMonth={parseDateValue(from) ?? new Date()}
                    onSelect={handleSelect}
                    locale={es}
                    numberOfMonths={1}
                    captionLayout='dropdown'
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2035, 11)}
                    className='[--cell-size:--spacing(9)]'
                />
                <div className='flex items-center justify-between gap-2 border-t px-3 py-2'>
                    <span className='text-xs text-muted-foreground'>
                        {label || 'Elegí la fecha de ida y vuelta'}
                    </span>
                    <div className='flex items-center gap-1'>
                        {clearable && hasValue && (
                            <Button
                                type='button'
                                variant='ghost'
                                size='xs'
                                onClick={() => onChange?.('', '')}>
                                Limpiar
                            </Button>
                        )}
                        <Button
                            type='button'
                            size='xs'
                            onClick={() => handleOpenChange(false)}>
                            {doneLabel}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
