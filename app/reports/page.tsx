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
    Cell,
    Legend
} from 'recharts'
import {
    Loader2,
    TrendingUp,
    Users,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface ReportData {
    byStatus: { name: string; value: number }[]
    byPriority: { name: string; value: number }[]
    byTravelTime: { name: string; value: number }[]
    byMonth: { month: string; value: number }[]
    byReferral: { name: string; value: number }[]
    total: number
    thisMonth: number
    lastMonth: number
}

export default function ReportsPage() {
    const [statusIds, setStatusIds] = useState<string[]>([])
    const [referralCode, setReferralCode] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const { data: statuses = [] } = useQuery<StatusOption[]>({
        queryKey: ['statuses'],
        queryFn: async () => {
            const res = await fetch('/api/status')
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            return data.filter((s: { isActive: number }) => s.isActive)
        }
    })

    const { data: referrals = [] } = useQuery<ReferralOption[]>({
        queryKey: ['referrals'],
        queryFn: async () => {
            const res = await fetch('/api/referrals')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        }
    })

    const params = new URLSearchParams()
    if (statusIds.length > 0) params.set('statusIds', statusIds.join(','))
    if (referralCode) params.set('referralCode', referralCode)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const { data: report, isLoading } = useQuery<ReportData>({
        queryKey: ['reports', statusIds, referralCode, dateFrom, dateTo],
        queryFn: async () => {
            const res = await fetch(`/api/reports?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch reports')
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
        setDateFrom('')
        setDateTo('')
    }

    const hasFilters =
        statusIds.length > 0 || referralCode || dateFrom || dateTo

    return (
        <div className='container mx-auto p-6 space-y-6'>
            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-medium'>Reports</h1>
                {hasFilters && (
                    <Button variant='ghost' size='sm' onClick={clearFilters}>
                        Clear Filters
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className='text-base'>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='grid gap-4 md:grid-cols-4'>
                        <div>
                            <Label className='text-xs mb-1 block'>Status</Label>
                            <Select
                                value={statusIds.length > 0 ? statusIds[0] : ''}
                                onValueChange={(val) =>
                                    setStatusIds(val ? [String(val)] : [])
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='All statuses' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            All statuses
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
                            <Label className='text-xs mb-1 block'>
                                Referral Code
                            </Label>
                            <Select
                                value={referralCode}
                                onValueChange={(val) =>
                                    setReferralCode(
                                        val === '' ? '' : String(val)
                                    )
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='All referrals' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value=''>
                                            All referrals
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
                            <Label className='text-xs mb-1 block'>From</Label>
                            <Input
                                type='date'
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className='h-8'
                            />
                        </div>
                        <div>
                            <Label className='text-xs mb-1 block'>To</Label>
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
                <div className='flex items-center justify-center py-16'>
                    <Loader2
                        size={24}
                        className='animate-spin text-muted-foreground'
                    />
                </div>
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
                                            Total Leads
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
                                            This Month
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
                                            Last Month
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
                                            Growth
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
                                    Leads per Month
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
                                        Leads by Status
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
                                        Leads by Priority
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
                                        Leads by Travel Time
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
                                        Leads by Referral Code
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
                    </div>
                </>
            )}
        </div>
    )
}
