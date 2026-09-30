'use client'

import Link from 'next/link'
import { ArrowUpRight, TrendingUp } from 'lucide-react'
import { cn } from 'cn'

import { Card, CardContent } from '@/components/ui/card'

export interface LeadStatusCount {
    statusId: number
    name: string
    color: string
    total: number
    newThisWeek: number
}

function StatusCard({
    statusId,
    name,
    color,
    total,
    newThisWeek
}: LeadStatusCount) {
    return (
        <Link
            href={`/leads?statusId=${statusId}`}
            className='group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'>
            <Card className='h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/40'>
                <CardContent className='flex h-full flex-col gap-3'>
                    <div className='flex items-start justify-between gap-2'>
                        <span className='flex items-center gap-2'>
                            <span
                                className='size-2.5 shrink-0 rounded-full'
                                style={{ backgroundColor: color }}
                            />
                            <span className='text-sm font-medium'>{name}</span>
                        </span>
                        <ArrowUpRight
                            size={14}
                            className='mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'
                        />
                    </div>

                    <p className='text-3xl leading-none font-semibold tabular-nums'>
                        {total}
                    </p>
                    <p className='-mt-2 text-xs text-muted-foreground'>
                        {total === 1 ? 'lead' : 'leads'}
                    </p>

                    <div
                        className={cn(
                            'mt-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs',
                            newThisWeek > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                        )}>
                        <TrendingUp size={13} className='shrink-0' />
                        <span>
                            {newThisWeek > 0
                                ? `+${newThisWeek} esta semana`
                                : 'Sin cambios esta semana'}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export function LeadStatusCards({
    counts,
    isError
}: {
    counts: LeadStatusCount[]
    isError?: boolean
}) {
    const totalNew = counts.reduce((acc, c) => acc + c.newThisWeek, 0)

    return (
        <section>
            <div className='mb-3 flex items-baseline justify-between gap-2'>
                <h2 className='text-sm font-medium'>Leads por estatus</h2>
                {counts.length > 0 && (
                    <span className='text-xs text-muted-foreground'>
                        {totalNew > 0
                            ? `${totalNew} nuevo${totalNew === 1 ? '' : 's'} esta semana`
                            : 'Semana en curso'}
                    </span>
                )}
            </div>

            {isError ? (
                <Card>
                    <CardContent>
                        <p className='text-sm text-muted-foreground'>
                            No se pudieron cargar los estatus de leads.
                        </p>
                    </CardContent>
                </Card>
            ) : counts.length === 0 ? (
                <Card>
                    <CardContent>
                        <p className='text-sm text-muted-foreground'>
                            No hay estatus activos configurados.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                    {counts.map((c) => (
                        <StatusCard key={c.statusId} {...c} />
                    ))}
                </div>
            )}
        </section>
    )
}