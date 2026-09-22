'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Loader2,
    RefreshCw,
    Upload,
    UserPlus,
    XCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { TagSelect, type TagOption } from '@/components/tags'
import { useSession } from '@/hooks/use-session'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import {
    buildTemplateCsv,
    mapColumnKey,
    REQUIRED_COLUMNS,
    type ImportReviewResult,
    type RawImportRow
} from '@/lib/leads-import'

interface ReviewResponse {
    results: ImportReviewResult[]
    summary: { total: number; valid: number; invalid: number }
}

interface ImportResponse {
    imported: number
    skipped: number
    outcomes: {
        index: number
        row: number
        status: 'imported' | 'skipped'
        reason?: string
    }[]
}

interface StatusOption {
    id: number
    status: string
    color: string
    isActive: number
}

interface PriorityOption {
    id: number
    priority: string
    color: string
    isActive: number
}

interface ReferralOption {
    id: number
    code: string
}

interface UserOption {
    id: string
    name: string | null
    email: string
}

const REQUIRED_COLUMN_LABELS: Record<string, string> = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    travelTime: 'travelTime'
}

function ValidBadge() {
    return (
        <span className='inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600'>
            <CheckCircle2 size={12} /> Valid
        </span>
    )
}

function InvalidBadge() {
    return (
        <span className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'>
            <XCircle size={12} /> With errors
        </span>
    )
}

export default function ImportLeadsPage() {
    const queryClient = useQueryClient()
    const { session, isPending: sessionLoading } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [fileName, setFileName] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [rows, setRows] = useState<RawImportRow[]>([])
    const [recognizedColumns, setRecognizedColumns] = useState<string[]>([])
    const [missingRequired, setMissingRequired] = useState<string[]>([])
    const [reviewData, setReviewData] = useState<ReviewResponse | null>(null)
    const [importResult, setImportResult] = useState<ImportResponse | null>(null)
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
    const [defaultStatusId, setDefaultStatusId] = useState('')
    const [defaultPriorityId, setDefaultPriorityId] = useState('')
    const [defaultReferralId, setDefaultReferralId] = useState('')
    const [defaultAssignedTo, setDefaultAssignedTo] = useState('')
    const [defaultCountry, setDefaultCountry] = useState('')

    const { data: statuses = [] } = useQuery({
        queryKey: ['statuses'],
        queryFn: () => fetch('/api/status').then((r) => r.json())
    }) as { data: StatusOption[] }

    const { data: priorities = [] } = useQuery({
        queryKey: ['priorities'],
        queryFn: () => fetch('/api/priority').then((r) => r.json())
    }) as { data: PriorityOption[] }

    const { data: referrals = [] } = useQuery({
        queryKey: ['referrals'],
        queryFn: () => fetch('/api/referrals').then((r) => r.json()),
        enabled: isAdmin
    }) as { data: ReferralOption[] }

    const { data: tagOptions = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: () => fetch('/api/tags').then((r) => r.json()),
        select: (data: Array<{
            id: number
            tag: string
            color: string
            isActive: number
        }>) =>
            data
                .filter((t) => t.isActive)
                .map((t) => ({
                    id: t.id,
                    name: t.tag,
                    color: t.color || '#6b7280',
                    isActive: t.isActive
                }))
    }) as { data: TagOption[] }

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then((r) => r.json()),
        select: (data: UserOption[]) =>
            data.map((u) => ({
                id: u.id,
                name: u.name || u.email
            })),
        enabled: isAdmin
    }) as { data: { id: string; name: string }[] }

    const statusLabel = new Map<number, string>()
    for (const s of statuses) statusLabel.set(s.id, s.status)
    const priorityLabel = new Map<number, string>()
    for (const p of priorities) priorityLabel.set(p.id, p.priority)
    const referralCode = new Map<number, string>()
    for (const r of referrals) referralCode.set(r.id, r.code)
    const userName = new Map<string, string>()
    for (const u of users) userName.set(u.id, u.name)

    const handleFile = (file: File | null) => {
        if (!file) return
        setFileName(file.name)
        setReviewData(null)
        setImportResult(null)
        setSelectedTagIds([])
        setDefaultStatusId('')
        setDefaultPriorityId('')
        setDefaultReferralId('')
        setDefaultAssignedTo('')
        setDefaultCountry('')

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            comments: '#',
            complete: (result) => {
                const fields = (result.meta.fields || []).filter(Boolean)
                const columnMap = new Map<string, string>()
                const recognized: string[] = []
                for (const header of fields) {
                    const key = mapColumnKey(header)
                    if (key) {
                        columnMap.set(header, key)
                        if (!recognized.includes(key)) recognized.push(key)
                    }
                }

                const missing = REQUIRED_COLUMNS.filter(
                    (c) => !recognized.includes(c)
                )
                setRecognizedColumns(recognized)
                setMissingRequired(missing)

                const parsedRows: RawImportRow[] = []
                for (const record of result.data) {
                    const row: RawImportRow = {}
                    for (const header of fields) {
                        const key = columnMap.get(header)
                        const value = record[header]
                        if (key && value !== undefined && value !== null) {
                            row[key] = String(value).trim()
                        }
                    }
                    if (
                        row.name ||
                        row.email ||
                        row.phone ||
                        row.travelTime
                    ) {
                        parsedRows.push(row)
                    }
                }
                setRows(parsedRows)

                if (missing.length > 0) {
                    toast.error(
                        `Missing required columns: ${missing
                            .map((m) => REQUIRED_COLUMN_LABELS[m])
                            .join(', ')}`
                    )
                } else if (parsedRows.length === 0) {
                    toast.error('The file does not contain any lead rows')
                }
            },
            error: (error) => {
                toast.error(error.message)
                setRows([])
            }
        })
    }

    const reviewMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/leads/import/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leads: rows,
                    defaultStatusId: defaultStatusId || undefined,
                    defaultPriorityId: defaultPriorityId || undefined,
                    defaultReferralId: defaultReferralId || undefined,
                    defaultAssignedTo: defaultAssignedTo || undefined,
                    defaultCountry: defaultCountry || undefined
                })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                throw new Error(err?.error || 'Failed to review the data')
            }
            return res.json()
        },
        onSuccess: (data: ReviewResponse) => {
            setReviewData(data)
            setImportResult(null)
            if (data.summary.valid === 0) {
                toast.error('No row is valid. Check the preview.')
            } else if (data.summary.invalid > 0) {
                toast.warning(
                    `${data.summary.valid} valid, ${data.summary.invalid} with errors`
                )
            } else {
                toast.success('All rows are valid')
            }
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!reviewData) throw new Error('Review the data first')
            const validLeads = reviewData.results
                .filter((r) => r.valid && r.lead)
                .map((r) => r.lead)

            const res = await fetch('/api/leads/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leads: validLeads,
                    tagIds: selectedTagIds,
                    defaultStatusId: defaultStatusId || undefined,
                    defaultPriorityId: defaultPriorityId || undefined,
                    defaultReferralId: defaultReferralId || undefined,
                    defaultAssignedTo: defaultAssignedTo || undefined,
                    defaultCountry: defaultCountry || undefined
                })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                throw new Error(err?.error || 'Failed to import the leads')
            }
            return res.json()
        },
        onSuccess: (data: ImportResponse) => {
            setImportResult(data)
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            toast.success(
                `${data.imported} lead${data.imported !== 1 ? 's' : ''} imported successfully`
            )
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const handleTemplateDownload = () => {
        const blob = new Blob([buildTemplateCsv()], {
            type: 'text/csv;charset=utf-8;'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'leads-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const validCount = reviewData?.summary.valid ?? 0

    if (sessionLoading) {
        return <GlobeLoader fullScreen={false} className='py-32' />
    }

    if (!session) {
        return (
            <div className='flex flex-col items-center justify-center py-32 text-center'>
                <UserPlus size={48} className='mb-4 text-muted-foreground' />
                <h2 className='mb-2 text-xl font-medium'>Sign in</h2>
                <p className='mb-6 text-muted-foreground'>
                    You need an active session to import leads.
                </p>
                <Link href='/signin'>
                    <Button>Sign in</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className='container mx-auto max-w-5xl p-6'>
            <Link
                href='/leads'
                className='mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ArrowLeft size={14} /> Back to leads
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>Import leads from CSV</CardTitle>
                    <CardDescription>
                        Upload a CSV file, review the preview, and load the
                        valid leads into the database.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {importResult ? (
                        <Alert>
                            <CheckCircle2 />
                            <AlertTitle>Import completed</AlertTitle>
                            <AlertDescription>
                                {importResult.imported} leads imported,{' '}
                                {importResult.skipped} skipped.{' '}
                                <Link href='/leads' className='underline'>
                                    View customers
                                </Link>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <Alert className='mb-4'>
                        <FileSpreadsheet />
                        <AlertTitle>File structure</AlertTitle>
                        <AlertDescription>
                            Required columns:{' '}
                            <span className='font-medium text-foreground'>
                                {REQUIRED_COLUMNS.join(', ')}
                            </span>
                            . Optional: country, statusId, priorityId,
                            referralCode, assignedTo. The{' '}
                            <span className='font-medium text-foreground'>
                                travelTime
                            </span>{' '}
                            field accepts: 0-3, 3-6, 6-12, 12-18 or 0.
                        </AlertDescription>
                        <div className='pt-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={handleTemplateDownload}>
                                <Download /> Download template
                            </Button>
                        </div>
                    </Alert>

                    <label
                        htmlFor='leads-csv-input'
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDragOver(true)
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault()
                            setDragOver(false)
                            handleFile(e.dataTransfer.files?.[0] ?? null)
                        }}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                            dragOver
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-muted/30 hover:bg-muted/50'
                        }`}>
                        <Upload
                            size={32}
                            className='text-muted-foreground'
                        />
                        <p className='text-sm font-medium'>
                            {fileName
                                ? fileName
                                : 'Drag and drop your CSV file here, or click to choose one'}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            Up to 500 rows per import
                        </p>
                        <input
                            ref={fileInputRef}
                            id='leads-csv-input'
                            type='file'
                            accept='.csv,text/csv'
                            className='hidden'
                            onChange={(e) =>
                                handleFile(e.target.files?.[0] ?? null)
                            }
                        />
                    </label>

                    {rows.length > 0 && (
                        <div className='mt-4 space-y-4'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm text-muted-foreground'>
                                    {rows.length} row{rows.length !== 1 ? 's' : ''}{' '}
                                    detected
                                    {recognizedColumns.length > 0 && (
                                        <>
                                            {' · Recognized columns: '}
                                            {recognizedColumns.join(', ')}
                                        </>
                                    )}
                                </span>
                                {missingRequired.length > 0 && (
                                    <span className='text-xs font-medium text-destructive'>
                                        Missing required columns:
                                        {missingRequired
                                            .map(
                                                (m) =>
                                                    REQUIRED_COLUMN_LABELS[m]
                                            )
                                            .join(', ')}
                                    </span>
                                )}
                            </div>

                            <div className='flex flex-col gap-3 rounded-lg border bg-muted/30 p-3'>
                                <span className='text-sm font-medium'>
                                    Apply to all imported leads
                                </span>
                                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                    <Field>
                                        <FieldLabel htmlFor='default-status'>
                                            Status
                                        </FieldLabel>
                                        <Select
                                            value={
                                                statuses.find(
                                                    (s) =>
                                                        s.id ===
                                                        Number(defaultStatusId)
                                                )?.status || ''
                                            }
                                            onValueChange={(val) =>
                                                setDefaultStatusId(val ?? '')
                                            }>
                                            <SelectTrigger
                                                id='default-status'
                                                className='h-8 w-full'>
                                                <SelectValue placeholder='No change' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        No change
                                                    </SelectItem>
                                                    {statuses.map((s) => (
                                                        <SelectItem
                                                            key={s.id}
                                                            value={String(
                                                                s.id
                                                            )}>
                                                            {s.status}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor='default-priority'>
                                            Priority
                                        </FieldLabel>
                                        <Select
                                            value={
                                                priorities.find(
                                                    (p) =>
                                                        p.id ===
                                                        Number(
                                                            defaultPriorityId
                                                        )
                                                )?.priority || ''
                                            }
                                            onValueChange={(val) =>
                                                setDefaultPriorityId(val ?? '')
                                            }>
                                            <SelectTrigger
                                                id='default-priority'
                                                className='h-8 w-full'>
                                                <SelectValue placeholder='No change' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        No change
                                                    </SelectItem>
                                                    {priorities.map((p) => (
                                                        <SelectItem
                                                            key={p.id}
                                                            value={String(
                                                                p.id
                                                            )}>
                                                            {p.priority}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor='default-country'>
                                            Country
                                        </FieldLabel>
                                        <Select
                                            value={defaultCountry}
                                            onValueChange={(val) =>
                                                setDefaultCountry(val ?? '')
                                            }>
                                            <SelectTrigger
                                                id='default-country'
                                                className='h-8 w-full'>
                                                <SelectValue placeholder='No change' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        No change
                                                    </SelectItem>
                                                    {COUNTRY_OPTIONS.map(
                                                        (country) => (
                                                            <SelectItem
                                                                key={country}
                                                                value={country}>
                                                                {country}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    {isAdmin && (
                                        <Field>
                                            <FieldLabel htmlFor='default-referral'>
                                                Referral
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    referrals.find(
                                                        (r) =>
                                                            r.id ===
                                                            Number(
                                                                defaultReferralId
                                                            )
                                                    )?.code || ''
                                                }
                                                onValueChange={(val) =>
                                                    setDefaultReferralId(
                                                        val ?? ''
                                                    )
                                                }>
                                                <SelectTrigger
                                                    id='default-referral'
                                                    className='h-8 w-full'>
                                                    <SelectValue placeholder='No change' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            No change
                                                        </SelectItem>
                                                        {referrals.map(
                                                            (r) => (
                                                                <SelectItem
                                                                    key={r.id}
                                                                    value={String(
                                                                        r.id
                                                                    )}>
                                                                    {r.code}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                    {isAdmin && (
                                        <Field>
                                            <FieldLabel htmlFor='default-assigned'>
                                                Assigned to
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    users.find(
                                                        (u) =>
                                                            u.id ===
                                                            defaultAssignedTo
                                                    )?.name || ''
                                                }
                                                onValueChange={(val) =>
                                                    setDefaultAssignedTo(
                                                        val ?? ''
                                                    )
                                                }>
                                                <SelectTrigger
                                                    id='default-assigned'
                                                    className='h-8 w-full'>
                                                    <SelectValue placeholder='No change' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            No change
                                                        </SelectItem>
                                                        {users.map((u) => (
                                                            <SelectItem
                                                                key={u.id}
                                                                value={u.id}>
                                                                {u.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                </div>
                                <div className='flex flex-col gap-1.5'>
                                    <span className='text-sm font-medium'>
                                        Tags
                                    </span>
                                    <TagSelect
                                        options={tagOptions}
                                        selected={selectedTagIds}
                                        onToggle={(id) =>
                                            setSelectedTagIds((prev) =>
                                                prev.includes(id)
                                                    ? prev.filter(
                                                          (i) => i !== id
                                                      )
                                                    : [...prev, id]
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            {!reviewData && (
                                <div className='flex items-center gap-2'>
                                    <Button
                                        onClick={() =>
                                            reviewMutation.mutate()
                                        }
                                        disabled={reviewMutation.isPending}>
                                        {reviewMutation.isPending ? (
                                            <Loader2
                                                size={16}
                                                className='animate-spin'
                                            />
                                        ) : (
                                            <RefreshCw size={16} />
                                        )}
                                        Review data
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        onClick={() => {
                                            setRows([])
                                            setReviewData(null)
                                            setImportResult(null)
                                            setFileName('')
                                            setSelectedTagIds([])
                                            setDefaultStatusId('')
                                            setDefaultPriorityId('')
                                            setDefaultReferralId('')
                                            setDefaultAssignedTo('')
                                            setDefaultCountry('')
                                            if (fileInputRef.current)
                                                fileInputRef.current.value = ''
                                        }}>
                                        Reset
                                    </Button>
                                </div>
                            )}

                            {reviewData && (
                                <Alert
                                    variant={
                                        reviewData.summary.invalid > 0
                                            ? 'destructive'
                                            : 'default'
                                    }>
                                    {(reviewData.summary.invalid > 0 ? (
                                        <AlertTriangle />
                                    ) : (
                                        <CheckCircle2 />
                                    ))}
                                    <AlertTitle>
                                        {reviewData.summary.valid} of{' '}
                                        {reviewData.summary.total} rows are valid
                                    </AlertTitle>
                                    <AlertDescription>
                                        Check the errors in each row before
                                        importing.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {reviewData && (
                                <div className='overflow-x-auto rounded-lg border'>
                                    <div className='max-h-[480px] overflow-y-auto'>
                                        <table className='w-full text-sm'>
                                            <thead className='sticky top-0 z-10 bg-muted'>
                                                <tr className='text-left text-muted-foreground'>
                                                    <th className='px-3 py-2 font-medium'>
                                                        #
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Name
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Email
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Phone
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Travel time
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Country
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Status
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Priority
                                                    </th>
                                                    {isAdmin && (
                                                        <th className='px-3 py-2 font-medium'>
                                                            Referral
                                                        </th>
                                                    )}
                                                    {isAdmin && (
                                                        <th className='px-3 py-2 font-medium'>
                                                            Assigned to
                                                        </th>
                                                    )}
                                                    <th className='px-3 py-2 font-medium'>
                                                        Result
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reviewData.results.map(
                                                    (result) => {
                                                        const lead =
                                                            result.lead
                                                        return (
                                                            <tr
                                                                key={
                                                                    result.index
                                                                }
                                                                className={`border-t align-top ${
                                                                    result.valid
                                                                        ? ''
                                                                        : 'bg-destructive/5'
                                                                }`}>
                                                                <td className='px-3 py-2 text-muted-foreground'>
                                                                    {result.row}
                                                                </td>
                                                                <td className='px-3 py-2 font-medium'>
                                                                    {lead?.name ||
                                                                        '—'}
                                                                </td>
                                                                <td className='px-3 py-2 text-muted-foreground'>
                                                                    {lead?.email ||
                                                                        '—'}
                                                                </td>
                                                                <td className='px-3 py-2'>
                                                                    {lead?.phone ||
                                                                        '—'}
                                                                </td>
                                                                <td className='px-3 py-2'>
                                                                    {
                                                                        lead?.travelTime ||
                                                                            '—'
                                                                    }
                                                                </td>
                                                                <td className='px-3 py-2'>
                                                                    {
                                                                        lead?.country ||
                                                                            '—'
                                                                    }
                                                                </td>
                                                                <td className='px-3 py-2'>
                                                                    {lead?.statusId
                                                                        ? statusLabel.get(
                                                                              lead.statusId
                                                                          ) ||
                                                                          String(
                                                                              lead.statusId
                                                                          )
                                                                        : '—'}
                                                                </td>
                                                                <td className='px-3 py-2'>
                                                                    {lead?.priorityId
                                                                        ? priorityLabel.get(
                                                                              lead.priorityId
                                                                          ) ||
                                                                          String(
                                                                              lead.priorityId
                                                                          )
                                                                        : '—'}
                                                                </td>
                                                                {isAdmin && (
                                                                    <td className='px-3 py-2'>
                                                                        {lead
                                                                            ?.referralId
                                                                            ? referralCode.get(
                                                                                  lead.referralId
                                                                              ) ||
                                                                              String(
                                                                                  lead.referralId
                                                                              )
                                                                            : '—'}
                                                                    </td>
                                                                )}
                                                                {isAdmin && (
                                                                    <td className='px-3 py-2'>
                                                                        {lead
                                                                            ?.assignedTo
                                                                            ? userName.get(
                                                                                  lead.assignedTo
                                                                              ) || '—'
                                                                            : '—'}
                                                                    </td>
                                                                )}
                                                                <td className='px-3 py-2'>
                                                                    <div className='flex flex-col items-start gap-1'>
                                                                        {result.valid ? (
                                                                            <ValidBadge />
                                                                        ) : (
                                                                            <InvalidBadge />
                                                                        )}
                                                                        {result
                                                                            .errors
                                                                            .length >
                                                                            0 && (
                                                                            <ul className='space-y-0.5 text-xs text-destructive'>
                                                                                {result.errors.map(
                                                                                    (
                                                                                        err
                                                                                    ) => (
                                                                                        <li
                                                                                            key={
                                                                                                err
                                                                                            }>
                                                            •{' '}
                                                                                            {
                                                                                                err
                                                                                            }
                                                                                        </li>
                                                                                    )
                                                                                )}
                                                                            </ul>
                                                                        )}
                                                                        {result
                                                                            .warnings
                                                                            .length >
                                                                            0 && (
                                                                            <ul className='space-y-0.5 text-xs text-muted-foreground'>
                                                                                {result.warnings.map(
                                                                                    (
                                                                                        w
                                                                                    ) => (
                                                                                        <li
                                                                                            key={
                                                                                                w
                                                                                            }>
                                                            ⚠ {w}
                                                                                        </li>
                                                                                    )
                                                                                )}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    }
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {reviewData && !importResult && (
                                <div className='flex items-center gap-2'>
                                    <Button
                                        onClick={() =>
                                            importMutation.mutate()
                                        }
                                        disabled={
                                            importMutation.isPending ||
                                            validCount === 0
                                        }>
                                        {importMutation.isPending ? (
                                            <Loader2
                                                size={16}
                                                className='animate-spin'
                                            />
                                        ) : (
                                            <Upload size={16} />
                                        )}
                                        Import {validCount} lead
                                        {validCount !== 1 ? 's' : ''}
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        onClick={() => setReviewData(null)}>
                                        Review again
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}