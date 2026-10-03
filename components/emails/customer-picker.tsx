'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Search,
    X
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { CAMPAIGN_MAX_RECIPIENTS } from '@/lib/email/constants'

export type RecipientOption = {
    id: number
    name: string
    email: string
    phone: string
    country: string | null
    statusName: string | null
    statusColor: string | null
    priorityName: string | null
    tags: string[]
    reachable: boolean
}

export type SelectedRecipient = {
    id: number
    name: string
    email: string
    reachable: boolean
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    const payload = await response.json()
    if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron cargar los datos')
    }
    return payload as T
}

/**
 * Selector de destinatarios con búsqueda y filtros. La selección se mantiene
 * aunque el usuario cambie de página o de filtro, y muestra cuántos son
 * alcanzables (tienen email válido) y cuántos se van a excluir.
 */
export function CustomerPicker({
    selected,
    onChange
}: {
    selected: Map<number, SelectedRecipient>
    onChange: (next: Map<number, SelectedRecipient>) => void
}) {
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [statusId, setStatusId] = useState('all')
    const [priorityId, setPriorityId] = useState('all')
    const [page, setPage] = useState(1)
    const [selectingAll, setSelectingAll] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(search)
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    const params = useMemo(() => {
        const query = new URLSearchParams({ page: String(page) })
        if (debounced) query.set('search', debounced)
        if (statusId !== 'all') query.set('statusId', statusId)
        if (priorityId !== 'all') query.set('priorityId', priorityId)
        return query.toString()
    }, [debounced, statusId, priorityId, page])

    const optionsQuery = useQuery({
        queryKey: ['email-recipients', params],
        queryFn: () =>
            fetchJson<{ data: RecipientOption[]; total: number }>(
                `/api/emails/recipients?${params}`
            )
    })

    // /api/status y /api/priority devuelven el arreglo directo, no envuelto.
    const statusesQuery = useQuery({
        queryKey: ['email-statuses'],
        queryFn: () =>
            fetchJson<Array<{ id: number; status: string; color: string }>>(
                '/api/status'
            )
    })

    const prioritiesQuery = useQuery({
        queryKey: ['email-priorities'],
        queryFn: () =>
            fetchJson<Array<{ id: number; priority: string; color: string }>>(
                '/api/priority'
            )
    })

    // Los <SelectItem> llegan de forma asíncrona, así que base-ui no siempre
    // encuentra la etiqueta y cae en mostrar el value crudo (el id). Por eso el
    // <SelectValue> recibe el texto explícito.
    const statusLabel =
        statusesQuery.data?.find((status) => String(status.id) === statusId)
            ?.status ?? 'Todos los estados'
    const priorityLabel =
        prioritiesQuery.data?.find(
            (priority) => String(priority.id) === priorityId
        )?.priority ?? 'Todas las prioridades'

    const rows = optionsQuery.data?.data ?? []
    const total = optionsQuery.data?.total ?? 0
    const pageSize = 50
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const allPageSelected =
        rows.length > 0 && rows.every((row) => selected.has(row.id))

    const toggle = (row: RecipientOption) => {
        const next = new Map(selected)
        if (next.has(row.id)) {
            next.delete(row.id)
        } else {
            if (next.size >= CAMPAIGN_MAX_RECIPIENTS) return
            next.set(row.id, {
                id: row.id,
                name: row.name,
                email: row.email,
                reachable: row.reachable
            })
        }
        onChange(next)
    }

    const togglePage = () => {
        const next = new Map(selected)
        if (allPageSelected) {
            for (const row of rows) next.delete(row.id)
        } else {
            for (const row of rows) {
                if (next.size >= CAMPAIGN_MAX_RECIPIENTS) break
                next.set(row.id, {
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    reachable: row.reachable
                })
            }
        }
        onChange(next)
    }

    const selectAllMatching = async () => {
        setSelectingAll(true)
        try {
            const allParams = new URLSearchParams({ allMatching: 'true' })
            if (debounced) allParams.set('search', debounced)
            if (statusId !== 'all') allParams.set('statusId', statusId)
            if (priorityId !== 'all') allParams.set('priorityId', priorityId)

            // El endpoint devuelve las filas completas de todos los que
            // cumplen el filtro, así no aparecen "Cliente {id}" al marcar todos.
            const payload = await fetchJson<{
                data: Array<
                    Pick<RecipientOption, 'id' | 'name' | 'email' | 'reachable'>
                >
                truncated: boolean
            }>(`/api/emails/recipients?${allParams.toString()}`)

            const next = new Map(selected)
            for (const row of payload.data) {
                if (next.size >= CAMPAIGN_MAX_RECIPIENTS) break
                next.set(row.id, row)
            }
            onChange(next)

            if (payload.truncated) {
                toast.warning(
                    `Se marcaron ${CAMPAIGN_MAX_RECIPIENTS} clientes: es el máximo por campaña`
                )
            }
        } finally {
            setSelectingAll(false)
        }
    }

    const reachable = [...selected.values()].filter((r) => r.reachable).length
    const unreachable = selected.size - reachable

    return (
        <div className='space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                    <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Buscar por nombre, email, teléfono o país'
                        className='pl-8'
                    />
                </div>

                <Select
                    value={statusId}
                    onValueChange={(value) => {
                        setStatusId(value || 'all')
                        setPage(1)
                    }}>
                    <SelectTrigger size='sm' className='w-[150px]'>
                        <SelectValue placeholder='Estado'>
                            {statusesQuery.isPending ? 'Estado' : statusLabel}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>Todos los estados</SelectItem>
                        {(statusesQuery.data ?? []).map((status) => (
                            <SelectItem
                                key={status.id}
                                value={String(status.id)}>
                                {status.status}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={priorityId}
                    onValueChange={(value) => {
                        setPriorityId(value || 'all')
                        setPage(1)
                    }}>
                    <SelectTrigger size='sm' className='w-[150px]'>
                        <SelectValue placeholder='Prioridad'>
                            {prioritiesQuery.isPending
                                ? 'Prioridad'
                                : priorityLabel}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>Todas las prioridades</SelectItem>
                        {(prioritiesQuery.data ?? []).map(
                            (priority) => (
                                <SelectItem
                                    key={priority.id}
                                    value={String(priority.id)}>
                                    {priority.priority}
                                </SelectItem>
                            )
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs'>
                <span>
                    {total} cliente{total === 1 ? '' : 's'} · {selected.size}{' '}
                    seleccionado{selected.size === 1 ? '' : 's'}
                    {reachable > 0 && ` · ${reachable} con email válido`}
                    {unreachable > 0 && (
                        <span className='text-destructive'>
                            {' '}
                            · {unreachable} se excluirán
                        </span>
                    )}
                </span>
                <div className='flex items-center gap-2'>
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        disabled={selectingAll || total === 0}
                        onClick={() => void selectAllMatching()}>
                        {selectingAll && (
                            <Loader2 className='animate-spin' />
                        )}
                        Seleccionar todos ({Math.min(
                            total,
                            CAMPAIGN_MAX_RECIPIENTS
                        )})
                    </Button>
                    {selected.size > 0 && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => onChange(new Map())}>
                            <X />
                            Limpiar
                        </Button>
                    )}
                </div>
            </div>

            <div className='overflow-hidden rounded-md border'>
                <div className='bg-muted/40 flex items-center gap-3 border-b px-3 py-2'>
                    <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={togglePage}
                        aria-label='Seleccionar esta página'
                    />
                    <span className='text-sm font-medium'>
                        Cliente
                    </span>
                </div>

                {optionsQuery.isPending ? (
                    <div className='text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm'>
                        <Loader2 className='animate-spin' />
                        Cargando clientes…
                    </div>
                ) : rows.length === 0 ? (
                    <div className='text-muted-foreground py-8 text-center text-sm'>
                        No hay clientes con esos filtros
                    </div>
                ) : (
                    <div className='max-h-[340px] overflow-y-auto'>
                        {rows.map((row) => (
                            <label
                                key={row.id}
                                className='hover:bg-muted/40 flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0'>
                                <Checkbox
                                    checked={selected.has(row.id)}
                                    onCheckedChange={() => toggle(row)}
                                    aria-label={`Seleccionar ${row.name}`}
                                />
                                <div className='min-w-0 flex-1'>
                                    <div className='flex items-center gap-2'>
                                        <span className='truncate text-sm font-medium'>
                                            {row.name}
                                        </span>
                                        {row.statusName && (
                                            <span
                                                className='shrink-0 rounded px-1.5 py-0.5 text-[10px] text-white'
                                                style={{
                                                    backgroundColor:
                                                        row.statusColor ||
                                                        '#6b7280'
                                                }}>
                                                {row.statusName}
                                            </span>
                                        )}
                                    </div>
                                    <div className='text-muted-foreground truncate text-xs'>
                                        {row.email || 'Sin email'}{' '}
                                        {row.country ? `· ${row.country}` : ''}
                                    </div>
                                </div>
                                {!row.reachable && (
                                    <span className='text-destructive flex shrink-0 items-center gap-1 text-xs'>
                                        <AlertCircle className='size-3.5' />
                                        Sin email
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className='flex items-center justify-between border-t px-3 py-2'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => prev - 1)}>
                            <ChevronLeft />
                            Anterior
                        </Button>
                        <span className='text-muted-foreground text-xs'>
                            Página {page} de {totalPages}
                        </span>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => prev + 1)}>
                            Siguiente
                            <ChevronRight />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}