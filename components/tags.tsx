'use client'

import { cn } from 'cn'

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
                No tags available. Create some in the admin panel first.
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