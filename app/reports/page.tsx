'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts'
import {
    TrendingUp,
    Users,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    SelectItem,
    SelectGroup,
    SelectContent,
    Select,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'

const COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16'
]

interface StatusOption {
    id: number
    status: string
}

interface ReferralOption {
    id: number
    code: string
    name: string | null
}

interface TagOption {
    id: number
    tag: string
}

interface ReportData {
    byStatus: { name: string; value: number }[]
    byPriority: { name: string; value: number }[]
    byTravelTime: { name: string; value: number }[]
    byMonth: { month: string; value: number }[]
    byReferral: { name: string; value: number }[]
    byTag: { name: string; value: number }[]
    total: number
    thisMonth: number
    lastMonth: number
}

export default function ReportsPage() {
    const [statusIds, setStatusIds] = useState<string[]>([])
    const [referralCode, setReferralCode] = useState('')
    const [tagId, setTagId] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const { data: statuses = [] } = useQuery<StatusOption[]>({
        queryKey: ['statuses'],
        queryFn: async () => {
            const res = await fetch('/api/status')
            if (!res.ok) throw new Error('No se pudo cargar')
            const data = await res.json()
            return data.filter((s: { isActive: number }) => s.isActive)
        }
    })

    const { data: referrals = [] } = useQuery<ReferralOption[]>({
        queryKey: ['referrals'],
        queryFn: async () => {
            const res = await fetch('/api/referrals')
            if (!res.ok) throw new Error('No se pudo cargar')
            return res.json()
        }
    })

    const { data: tags = [] } = useQuery<TagOption[]>({
        queryKey: ['tags'],
        queryFn: async () => {
            const res = await fetch('/api/tags')
            if (!res.ok) throw new Error('No se pudo cargar')
            const data = await res.json()
            return data.filter((t: { isActive: number }) => t.isActive)
        }
    })

    const params = new URLSearchParams()
    if (statusIds.length > 0) params.set('statusIds', statusIds.join(','))
    if (referralCode) params.set('referralCode', referralCode)
    if (tagId) params.set('tagIds', tagId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const { data: report, isLoading } = useQuery<ReportData>({
        queryKey: ['reports', statusIds, referralCode, tagId, dateFrom, dateTo],
        queryFn: async () => {
            const res = await fetch(`/api/reports?${params.toString()}`)
            if (!res.ok) throw new Error('No se pudieron cargar los reportes')
            return res.json()
        }
    })

    const growth =
        report && report.lastMonth > 0
            ? Math.round(
                  ((report.thisMonth - report.lastMonth) / report.lastMonth) *
                      100
              )
            : report && report.thisMonth > 0
              ? 100
              : 0

    const clearFilters = () => {
        setStatusIds([])
        setReferralCode('')
        setTagId('')
        setDateFrom('')
        setDateTo('')
    }

    const hasFilters =
        statusIds.length > 0 || referralCode || tagId || dateFrom || dateTo

    // Los <SelectItem> de estado/etiqueta/referido llegan de forma asíncrona,
    // así que base-ui puede mostrar el value crudo (el id) en vez de la
    // etiqueta. Se le pasa el texto explícito al <SelectValue>.
    const statusLabel =
        statuses.find((s) => String(s.id) === statusIds[0])?.status ??
        'Todos los estados'
    const tagLabel = tags.find((t) => String(t.id) === tagId)?.tag ?? 'Todas las etiquetas'
    const referralLabel =
        referrals.find((r) => r.code === referralCode)?.code ?? 'Todos los referidos'

    return (
        <div className='container mx-auto p-6 space-y-6'>
            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-medium'>Reportes</h1>
                {hasFilters && (
                    <Button variant='ghost' size='sm' onClick={clearFilters}>
                        Limpiar filtros
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className='text-base'>Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='grid gap-4 md:grid-cols-5'>
                        <div>
                            <Label className='text-xs mb-1 block'>Estado</Label>
                            <Select
                                value={statusIds.length > 0 ? statusIds[0] : ''}
                                onValueChange={(val) =>
                                    setStatusIds(val ? [String(val)] : [])
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='Todos los estados'>
                                        {statusLabel}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            Todos los estados
                                        </SelectItem>
                                        {statuses.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={String(s.id)}>
                                                {s.status}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className='text-xs mb-1 block'>Etiqueta</Label>
                            <Select
                                value={tagId}
                                onValueChange={(val) =>
                                    setTagId(val === '' ? '' : String(val))
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='Todas las etiquetas'>
                                        {tagLabel}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            Todas las etiquetas
                                        </SelectItem>
                                        {tags.map((t) => (
                                            <SelectItem
                                                key={t.id}
                                                value={String(t.id)}>
                                                {t.tag}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className='text-xs mb-1 block'>
                                Código de referido
                            </Label>
                            <Select
                                value={referralCode}
                                onValueChange={(val) =>
                                    setReferralCode(
                                        val === '' ? '' : String(val)
                                    )
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='Todos los referidos'>
                                        {referralLabel}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            Todos los referidos
                                        </SelectItem>
                                        {referrals.map((r) => (
                                            <SelectItem
                                                key={r.id}
                                                value={r.code}>
                                                {r.code}
                                                {r.name ? ` (${r.name})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className='text-xs mb-1 block'>Desde</Label>
                            <Input
                                type='date'
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className='h-8'
                            />
                        </div>
                        <div>
                            <Label className='text-xs mb-1 block'>Hasta</Label>
                            <Input
                                type='date'
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className='h-8'
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading || !report ? (
                <GlobeLoader fullScreen={false} className='py-16' />
            ) : (
                <>
                    <div className='grid gap-4 md:grid-cols-4'>
                        <Card>
                            <CardContent className='pt-6'>
                                <div className='flex items-center gap-3'>
                                    <div className='rounded-lg bg-primary/10 p-2'>
                                        <Users
                                            size={20}
                                            className='text-primary'
                                        />
                                    </div>
                                    <div>
                                        <p className='text-2xl font-bold'>
                                            {report.total}
                                        </p>
                                        <p className='text-xs text-muted-foreground'>
                                            Total de leads
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='pt-6'>
                                <div className='flex items-center gap-3'>
                                    <div className='rounded-lg bg-green-500/10 p-2'>
                                        <Calendar
                                            size={20}
                                            className='text-green-600'
                                        />
                                    </div>
                                    <div>
                                        <p className='text-2xl font-bold'>
                                            {report.thisMonth}
                                        </p>
                                        <p className='text-xs text-muted-foreground'>
                                            Este mes
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='pt-6'>
                                <div className='flex items-center gap-3'>
                                    <div className='rounded-lg bg-blue-500/10 p-2'>
                                        <Calendar
                                            size={20}
                                            className='text-blue-600'
                                        />
                                    </div>
                                    <div>
                                        <p className='text-2xl font-bold'>
                                            {report.lastMonth}
                                        </p>
                                        <p className='text-xs text-muted-foreground'>
                                            Mes pasado
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className='pt-6'>
                                <div className='flex items-center gap-3'>
                                    <div className='rounded-lg bg-amber-500/10 p-2'>
                                        <TrendingUp
                                            size={20}
                                            className='text-amber-600'
                                        />
                                    </div>
                                    <div>
                                        <div className='flex items-center gap-1'>
                                            <p className='text-2xl font-bold'>
                                                {growth > 0 ? '+' : ''}
                                                {growth}%
                                            </p>
                                            {growth > 0 ? (
                                                <ArrowUpRight
                                                    size={16}
                                                    className='text-green-600'
                                                />
                                            ) : growth < 0 ? (
                                                <ArrowDownRight
                                                    size={16}
                                                    className='text-red-600'
                                                />
                                            ) : null}
                                        </div>
                                        <p className='text-xs text-muted-foreground'>
                                            Crecimiento
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {report.byMonth.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className='text-base'>
                                    Leads por mes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width='100%' height={300}>
                                    <BarChart data={report.byMonth}>
                                        <CartesianGrid
                                            strokeDasharray='3 3'
                                            className='stroke-border'
                                        />
                                        <XAxis
                                            dataKey='month'
                                            className='text-xs'
                                        />
                                        <YAxis className='text-xs' />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--card)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Bar
                                            dataKey='value'
                                            fill='#3b82f6'
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    <div className='grid gap-4 md:grid-cols-2'>
                        {report.byStatus.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        Leads por estado
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer
                                        width='100%'
                                        height={280}>
                                        <PieChart>
                                            <Pie
                                                data={report.byStatus}
                                                cx='50%'
                                                cy='50%'
                                                outerRadius={90}
                                                dataKey='value'
                                                label={({ name, percent }) =>
                                                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                                }
                                                labelLine={false}>
                                                {report.byStatus.map((_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={
                                                            COLORS[
                                                                i %
                                                                    COLORS.length
                                                            ]
                                                        }
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {report.byPriority.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        Leads por prioridad
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer
                                        width='100%'
                                        height={280}>
                                        <PieChart>
                                            <Pie
                                                data={report.byPriority}
                                                cx='50%'
                                                cy='50%'
                                                outerRadius={90}
                                                dataKey='value'
                                                label={({ name, percent }) =>
                                                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                                }
                                                labelLine={false}>
                                                {report.byPriority.map(
                                                    (_, i) => (
                                                        <Cell
                                                            key={i}
                                                            fill={
                                                                COLORS[
                                                                    i %
                                                                        COLORS.length
                                                                ]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {report.byTravelTime.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        Leads por tiempo de viaje
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer
                                        width='100%'
                                        height={280}>
                                        <PieChart>
                                            <Pie
                                                data={report.byTravelTime}
                                                cx='50%'
                                                cy='50%'
                                                outerRadius={90}
                                                dataKey='value'
                                                label={({ name, percent }) =>
                                                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                                }
                                                labelLine={false}>
                                                {report.byTravelTime.map(
                                                    (_, i) => (
                                                        <Cell
                                                            key={i}
                                                            fill={
                                                                COLORS[
                                                                    i %
                                                                        COLORS.length
                                                                ]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {report.byReferral.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        Leads por código de referido
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer
                                        width='100%'
                                        height={280}>
                                        <BarChart
                                            data={report.byReferral}
                                            layout='vertical'>
                                            <CartesianGrid
                                                strokeDasharray='3 3'
                                                className='stroke-border'
                                            />
                                            <XAxis
                                                type='number'
                                                className='text-xs'
                                            />
                                            <YAxis
                                                dataKey='name'
                                                type='category'
                                                className='text-xs'
                                                width={80}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Bar
                                                dataKey='value'
                                                fill='#8b5cf6'
                                                radius={[0, 4, 4, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {report.byTag.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        Leads por etiqueta
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer
                                        width='100%'
                                        height={280}>
                                        <BarChart
                                            data={report.byTag}
                                            layout='vertical'>
                                            <CartesianGrid
                                                strokeDasharray='3 3'
                                                className='stroke-border'
                                            />
                                            <XAxis
                                                type='number'
                                                className='text-xs'
                                            />
                                            <YAxis
                                                dataKey='name'
                                                type='category'
                                                className='text-xs'
                                                width={100}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Bar
                                                dataKey='value'
                                                fill='#06b6d4'
                                                radius={[0, 4, 4, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
