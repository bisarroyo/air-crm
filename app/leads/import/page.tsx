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
            <CheckCircle2 size={12} /> Válida
        </span>
    )
}

function InvalidBadge() {
    return (
        <span className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'>
            <XCircle size={12} /> Con errores
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
                        `Faltan columnas obligatorias: ${missing
                            .map((m) => REQUIRED_COLUMN_LABELS[m])
                            .join(', ')}`
                    )
                } else if (parsedRows.length === 0) {
                    toast.error('El archivo no contiene filas de leads')
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
                throw new Error(err?.error || 'No se pudo revisar la información')
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
                toast.success('Todas las filas son válidas')
            }
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!reviewData) throw new Error('Primero tenés que revisar la información')
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
                throw new Error(err?.error || 'No se pudieron importar los leads')
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
                <h2 className='mb-2 text-xl font-medium'>Iniciá sesión</h2>
                <p className='mb-6 text-muted-foreground'>
                    Necesitás una sesión activa para importar leads.
                </p>
                <Link href='/signin'>
                    <Button>Iniciar sesión</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className='container mx-auto max-w-5xl p-6'>
            <Link
                href='/leads'
                className='mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ArrowLeft size={14} /> Volver a leads
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>Importar leads desde CSV</CardTitle>
                    <CardDescription>
                        Subí un archivo CSV, revisá la vista previa y cargá
                        los leads válidos en la base de datos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {importResult ? (
                        <Alert>
                            <CheckCircle2 />
                            <AlertTitle>Importación completada</AlertTitle>
                            <AlertDescription>
                                {importResult.imported} leads importados,{' '}
                                {importResult.skipped} omitidos.{' '}
                                <Link href='/leads' className='underline'>
                                    Ver clientes
                                </Link>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <Alert className='mb-4'>
                        <FileSpreadsheet />
                        <AlertTitle>Estructura del archivo</AlertTitle>
                        <AlertDescription>
                            Columnas obligatorias:{' '}
                            <span className='font-medium text-foreground'>
                                {REQUIRED_COLUMNS.join(', ')}
                            </span>
                            . Opcionales: country, statusId, priorityId,
                            referralCode, assignedTo. El campo{' '}
                            <span className='font-medium text-foreground'>
                                travelTime
                            </span>{' '}
                            acepta: 0-3, 3-6, 6-12, 12-18 o 0.
                        </AlertDescription>
                        <div className='pt-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={handleTemplateDownload}>
                                <Download /> Descargar plantilla
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
                                : 'Arrastrá tu archivo CSV acá, o hacé clic para elegirlo'}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            Hasta 500 filas por importación
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
                                    {rows.length} fila
                                    {rows.length !== 1 ? 's' : ''}{' '}
                                    detectada
                                    {rows.length !== 1 ? 's' : ''}
                                    {recognizedColumns.length > 0 && (
                                        <>
                                            {' · Columnas reconocidas: '}
                                            {recognizedColumns.join(', ')}
                                        </>
                                    )}
                                </span>
                                {missingRequired.length > 0 && (
                                    <span className='text-xs font-medium text-destructive'>
                                        Faltan columnas obligatorias:
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
                                    Aplicar a todos los leads importados
                                </span>
                                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                    <Field>
                                        <FieldLabel htmlFor='default-status'>
                                            Estado
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
                                                <SelectValue placeholder='Sin cambio' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        Sin cambio
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
                                            Prioridad
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
                                                <SelectValue placeholder='Sin cambio' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        Sin cambio
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
                                            País
                                        </FieldLabel>
                                        <Select
                                            value={defaultCountry}
                                            onValueChange={(val) =>
                                                setDefaultCountry(val ?? '')
                                            }>
                                            <SelectTrigger
                                                id='default-country'
                                                className='h-8 w-full'>
                                                <SelectValue placeholder='Sin cambio' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value=''>
                                                        Sin cambio
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
                                                Referido
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
                                                    <SelectValue placeholder='Sin cambio' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            Sin cambio
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
                                                Asignado a
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
                                                    <SelectValue placeholder='Sin cambio' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value=''>
                                                            Sin cambio
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
                                        Etiquetas
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
                                        Revisar datos
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
                                        Reiniciar
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
                                        {reviewData.summary.valid} de{' '}
                                        {reviewData.summary.total} filas son válidas
                                    </AlertTitle>
                                    <AlertDescription>
                                        Revisá los errores de cada fila antes
                                        de importar.
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
                                                        Nombre
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Email
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Teléfono
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Tiempo de viaje
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        País
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Estado
                                                    </th>
                                                    <th className='px-3 py-2 font-medium'>
                                                        Prioridad
                                                    </th>
                                                    {isAdmin && (
                                                        <th className='px-3 py-2 font-medium'>
                                                            Referido
                                                        </th>
                                                    )}
                                                    {isAdmin && (
                                                        <th className='px-3 py-2 font-medium'>
                                                            Asignado a
                                                        </th>
                                                    )}
                                                    <th className='px-3 py-2 font-medium'>
                                                        Resultado
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
                                        Importar {validCount} lead
                                        {validCount !== 1 ? 's' : ''}
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        onClick={() => setReviewData(null)}>
                                        Revisar de nuevo
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