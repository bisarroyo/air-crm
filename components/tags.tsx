'use client'

import * as React from 'react'
import { cn } from 'cn'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover'

export interface TagOption {
    id: number
    name: string
    color: string
    isActive: number
}

export function TagPill({ tag }: { tag: TagOption }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                !tag.isActive && 'opacity-50'
            )}
            style={{
                backgroundColor: `${tag.color || '#6b7280'}1a`,
                color: tag.color || '#6b7280'
            }}>
            <span
                className='inline-block h-2 w-2 shrink-0 rounded-full'
                style={{ backgroundColor: tag.color || '#6b7280' }}
            />
            {tag.name}
        </span>
    )
}

export function TagSelect({
    options,
    selected,
    onToggle,
    className
}: {
    options: TagOption[]
    selected: number[]
    onToggle: (id: number) => void
    className?: string
}) {
    if (options.length === 0) {
        return (
            <p className='text-xs text-muted-foreground'>
                No hay etiquetas disponibles. Creá algunas en el panel de administración primero.
            </p>
        )
    }
    return (
        <div className={cn('flex flex-wrap gap-1.5', className)}>
            {options.map((tag) => {
                const active = selected.includes(tag.id)
                return (
                    <button
                        key={tag.id}
                        type='button'
                        onClick={() => onToggle(tag.id)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            active
                                ? 'border-transparent text-white'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        )}
                        style={
                            active
                                ? { backgroundColor: tag.color || '#6b7280' }
                                : undefined
                        }>
                        <span
                            className='inline-block h-2 w-2 shrink-0 rounded-full'
                            style={{
                                backgroundColor: active
                                    ? 'rgba(255,255,255,0.9)'
                                    : tag.color || '#6b7280'
                            }}
                        />
                        {tag.name}
                    </button>
                )
            })}
        </div>
    )
}
export function TagMultiSelect({
    options,
    selected,
    onToggle,
    placeholder = 'Seleccionar etiquetas',
    searchPlaceholder = 'Buscar etiqueta...',
    emptyMessage = 'No hay etiquetas disponibles.',
    triggerClassName,
    maxChips = 2
}: {
    options: TagOption[]
    selected: number[]
    onToggle: (id: number) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    triggerClassName?: string
    maxChips?: number
}) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')

    const selectedTags = selected
        .map((id) => options.find((t) => t.id === id))
        .filter((t): t is TagOption => Boolean(t))

    const visible = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter((t) => t.name.toLowerCase().includes(q))
    }, [options, query])

    const chips = selectedTags.slice(0, maxChips)
    const rest = selectedTags.length - chips.length

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) setQuery('')
            }}>
            <PopoverTrigger
                render={
                    <Button
                        type='button'
                        variant='outline'
                        className={cn(
                            'h-7 w-full justify-between gap-1.5 px-2 text-xs font-normal',
                            triggerClassName
                        )}
                    />
                }>
                {selectedTags.length === 0 ? (
                    <span className='truncate text-muted-foreground'>
                        {placeholder}
                    </span>
                ) : (
                    <span className='flex min-w-0 items-center gap-1'>
                        {chips.map((tag) => (
                            <span
                                key={tag.id}
                                className='inline-flex max-w-[110px] items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium'
                                style={{
                                    backgroundColor: `${tag.color || '#6b7280'}1a`,
                                    color: tag.color || '#6b7280'
                                }}>
                                <span
                                    className='inline-block h-1.5 w-1.5 shrink-0 rounded-full'
                                    style={{
                                        backgroundColor:
                                            tag.color || '#6b7280'
                                    }}
                                />
                                <span className='truncate'>{tag.name}</span>
                            </span>
                        ))}
                        {rest > 0 && (
                            <span className='text-[11px] text-muted-foreground'>
                                +{rest}
                            </span>
                        )}
                    </span>
                )}
                <ChevronDown className='size-3.5 shrink-0 opacity-60' />
            </PopoverTrigger>
            <PopoverContent
                align='start'
                className='w-(--anchor-width) min-w-[220px] gap-0 p-0'>
                <div className='border-b p-2'>
                    <div className='relative'>
                        <Search
                            size={14}
                            className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                        />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className='h-7 pl-8 text-xs'
                        />
                    </div>
                </div>
                <div className='max-h-56 overflow-y-auto p-1'>
                    {visible.length === 0 ? (
                        <p className='px-2 py-3 text-center text-xs text-muted-foreground'>
                            {emptyMessage}
                        </p>
                    ) : (
                        visible.map((tag) => {
                            const active = selected.includes(tag.id)
                            return (
                                <button
                                    key={tag.id}
                                    type='button'
                                    onClick={() => onToggle(tag.id)}
                                    className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground'>
                                    <span
                                        className={cn(
                                            'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                                            active
                                                ? 'border-transparent text-white'
                                                : 'border-input'
                                        )}
                                        style={
                                            active
                                                ? {
                                                      backgroundColor:
                                                          tag.color ||
                                                          '#6b7280'
                                                  }
                                                : undefined
                                        }>
                                        {active && <Check size={12} />}
                                    </span>
                                    <span className='flex-1 truncate'>
                                        {tag.name}
                                    </span>
                                </button>
                            )
                        })
                    )}
                </div>
                {selectedTags.length > 0 && (
                    <div className='flex items-center justify-between gap-2 border-t px-2 py-1.5'>
                        <span className='text-xs text-muted-foreground'>
                            {selectedTags.length} seleccionada
                            {selectedTags.length === 1 ? '' : 's'}
                        </span>
                        <button
                            type='button'
                            onClick={() => selected.forEach((id) => onToggle(id))}
                            className='inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'>
                            <X size={12} />
                            Limpiar
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
