'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    Copy,
    Download,
    FileCode2,
    KeyRound,
    ListChecks,
    PlugZap,
    RefreshCw,
    RotateCcw,
    Save,
    Sparkles,
    Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
    CodeBlock,
    CodeBlockActions,
    CodeBlockContent,
    CodeBlockCopyButton,
    CodeBlockHeader,
    CodeBlockTitle
} from '@/components/ui/code-block'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Switch } from '@/components/ui/switch'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs'
import {
    formatDate,
    isInFlight,
    readJson,
    StatusPicker,
    statusSummary,
    type Integration,
    type IntegrationsResponse
} from '@/components/integrations/google-sheets-shared'
import {
    LEAD_FIELDS,
    LEAD_FIELD_DESCRIPTIONS,
    LEAD_FIELD_LABELS,
    sameLeadFields,
    type LeadField
} from '@/lib/integrations/google-sheets-fields'

interface FormState {
    name: string
    enabled: boolean
    webAppUrl: string
    secret: string
    maxAttempts: number
    syncCustomers: boolean
    syncTravel: boolean
    customerStatusIds: number[]
    travelStatusIds: number[]
    fields: LeadField[]
}

interface ScriptProperty {
    key: string
    value: string
    description: string
}

interface AppsScriptResponse {
    integrationId: number
    code: string
    filename: string
    properties: ScriptProperty[]
    steps: string[]
    fields: LeadField[]
}

function emptyForm(): FormState {
    return {
        name: '',
        enabled: false,
        webAppUrl: '',
        secret: '',
        maxAttempts: 8,
        syncCustomers: true,
        syncTravel: true,
        customerStatusIds: [],
        travelStatusIds: [],
        fields: [...LEAD_FIELDS]
    }
}

function formFrom(integration: Integration): FormState {
    return {
        name: integration.name,
        enabled: integration.enabled,
        webAppUrl: integration.webAppUrl,
        secret: '',
        maxAttempts: integration.maxAttempts,
        syncCustomers: integration.syncCustomers,
        syncTravel: integration.syncTravel,
        customerStatusIds: integration.customerStatusIds,
        travelStatusIds: integration.travelStatusIds,
        fields: integration.fields
    }
}

function CopyValueButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false)

    async function copy() {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('No se pudo copiar al portapapeles')
        }
    }

    return (
        <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label={label}
            onClick={copy}>
            {copied ? <Check /> : <Copy />}
        </Button>
    )
}

function FieldPicker({
    selected,
    onChange
}: {
    selected: LeadField[]
    onChange: (fields: LeadField[]) => void
}) {
    function toggle(field: LeadField, checked: boolean) {
        if (checked) {
            onChange(LEAD_FIELDS.filter((item) => item === field || selected.includes(item)))
        } else {
            onChange(selected.filter((item) => item !== field))
        }
    }

    return (
        <div className='space-y-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <Label>Columnas de la hoja</Label>
                    <p className='text-xs text-muted-foreground'>
                        Se exportan en este orden fijo, seguidas de una columna
                        oculta con el ID interno.
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onChange([...LEAD_FIELDS])}
                    disabled={selected.length === LEAD_FIELDS.length}>
                    Seleccionar todos
                </Button>
            </div>

            <div className='grid gap-2 sm:grid-cols-2'>
                {LEAD_FIELDS.map((field) => {
                    const checked = selected.includes(field)
                    return (
                        <label
                            key={field}
                            className='flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40'>
                            <Checkbox
                                className='mt-0.5'
                                checked={checked}
                                onCheckedChange={(value) =>
                                    toggle(field, Boolean(value))
                                }
                            />
                            <span className='min-w-0'>
                                <span className='block text-sm font-medium'>
                                    {LEAD_FIELD_LABELS[field]}
                                </span>
                                <span className='block text-xs text-muted-foreground'>
                                    {LEAD_FIELD_DESCRIPTIONS[field]}
                                </span>
                            </span>
                        </label>
                    )
                })}
            </div>

            {selected.length === 0 && (
                <p className='flex items-center gap-2 text-sm text-destructive'>
                    <AlertTriangle className='size-4' />
                    Seleccioná al menos un campo para poder guardar.
                </p>
            )}

            <div className='rounded-lg border bg-muted/30 p-3'>
                <p className='mb-2 text-xs font-medium text-muted-foreground'>
                    Encabezados resultantes en la pestaña “Leads”
                </p>
                <div className='flex flex-wrap gap-1.5'>
                    {selected.map((field) => (
                        <Badge key={field} variant='secondary'>
                            {LEAD_FIELD_LABELS[field]}
                        </Badge>
                    ))}
                    <Badge variant='outline'>__id (oculta)</Badge>
                </div>
            </div>
        </div>
    )
}

function PropertyRow({ property }: { property: ScriptProperty }) {
    return (
        <div className='flex flex-wrap items-start justify-between gap-3 border-b py-3 last:border-b-0'>
            <div className='min-w-0 space-y-1'>
                <code className='font-mono text-sm font-semibold'>
                    {property.key}
                </code>
                <p className='text-xs text-muted-foreground'>
                    {property.description}
                </p>
            </div>
            <div className='flex items-center gap-1'>
                <code className='max-w-[260px] truncate rounded bg-muted px-2 py-1 font-mono text-xs'>
                    {property.value || 'Valor que definís vos'}
                </code>
                {property.value && (
                    <CopyValueButton
                        value={property.value}
                        label={`Copiar ${property.key}`}
                    />
                )}
            </div>
        </div>
    )
}

export function GoogleSheetsDetail({
    organizationId,
    integrationId
}: {
    organizationId: string
    integrationId?: number
}) {
    const queryKey = ['google-sheets-integrations', organizationId] as const
    const { data, isLoading, error } = useQuery<IntegrationsResponse>({
        queryKey,
        queryFn: async () => {
            const response = await fetch('/api/integrations/google-sheets')
            return readJson(response)
        },
        refetchInterval: (query) => {
            const integrations = query.state.data?.integrations ?? []
            return integrations.some(isInFlight) ? 5000 : false
        }
    })

    if (isLoading) {
        return <GlobeLoader fullScreen={false} className='py-16' size={120} />
    }

    if (error || !data) {
        return (
            <Card>
                <CardContent className='flex items-center gap-2 py-8 text-sm text-destructive'>
                    <AlertTriangle className='size-4' />
                    {error instanceof Error
                        ? error.message
                        : 'No se pudieron cargar las integraciones'}
                </CardContent>
            </Card>
        )
    }

    const integration = integrationId
        ? data.integrations.find((item) => item.id === integrationId) ?? null
        : null

    if (integrationId && !integration) {
        return (
            <Card>
                <CardContent className='space-y-4 py-10 text-center'>
                    <p className='font-medium'>Esta integración no existe</p>
                    <p className='text-sm text-muted-foreground'>
                        Puede que se haya eliminado o que pertenezca a otra
                        organización.
                    </p>
                    <Link
                        href='/admin/integrations/google-sheets'
                        className={buttonVariants({ variant: 'outline' })}>
                        Volver a la lista
                    </Link>
                </CardContent>
            </Card>
        )
    }

    return (
        <GoogleSheetsDetailForm
            key={integration ? `edit-${integration.id}` : 'new'}
            organizationId={organizationId}
            payload={data}
            integration={integration}
        />
    )
}

function GoogleSheetsDetailForm({
    organizationId,
    payload,
    integration
}: {
    organizationId: string
    payload: IntegrationsResponse
    integration: Integration | null
}) {
    const queryKey = ['google-sheets-integrations', organizationId] as const
    const queryClient = useQueryClient()
    const router = useRouter()
    const [form, setForm] = useState<FormState>(() =>
        integration ? formFrom(integration) : emptyForm()
    )
    const [syncing, setSyncing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [scriptRefreshing, setScriptRefreshing] = useState(false)

    const statuses = {
        customer: payload.customerStatuses,
        travel: payload.travelStatuses
    }

    const scriptUrl = integration
        ? `/api/integrations/google-sheets/${integration.id}/script`
        : null

    const scriptQuery = useQuery<AppsScriptResponse>({
        queryKey: [
            'google-sheets-script',
            organizationId,
            integration?.id ?? 0,
            integration?.fields ?? []
        ],
        enabled: Boolean(scriptUrl),
        queryFn: async () => {
            if (!scriptUrl) throw new Error('Falta la integración')
            const response = await fetch(scriptUrl)
            return readJson(response)
        }
    })

    const saveMutation = useMutation({
        mutationFn: async () => {
            const body = {
                ...(integration ? { id: integration.id } : {}),
                name: form.name.trim() || undefined,
                enabled: form.enabled,
                webAppUrl: form.webAppUrl,
                secret: form.secret.trim() ? form.secret.trim() : undefined,
                maxAttempts: form.maxAttempts,
                syncCustomers: form.syncCustomers,
                syncTravel: form.syncTravel,
                customerStatusIds: form.customerStatusIds,
                travelStatusIds: form.travelStatusIds,
                fields: form.fields
            }
            return readJson(
                await fetch('/api/integrations/google-sheets', {
                    method: integration ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
            ) as Promise<IntegrationsResponse>
        },
        onSuccess: (result) => {
            queryClient.setQueryData(queryKey, result)
            setForm((current) => ({ ...current, secret: '' }))

            if (result.createdIntegrationId) {
                toast.success('Integración creada correctamente')
                router.replace(
                    `/admin/integrations/google-sheets/${result.createdIntegrationId}`
                )
                return
            }

            toast.success('Integración actualizada correctamente')
            setScriptRefreshing(true)
            queryClient
                .invalidateQueries({
                    queryKey: ['google-sheets-script', organizationId]
                })
                .finally(() => setScriptRefreshing(false))
        },
        onError: (mutationError: Error) =>
            toast.error(mutationError.message)
    })

    const testMutation = useMutation({
        mutationFn: async () =>
            readJson(
                await fetch('/api/integrations/google-sheets/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        integrationId: integration?.id,
                        webAppUrl: form.webAppUrl.trim() || undefined,
                        secret: form.secret.trim() || undefined
                    })
                })
            ),
        onSuccess: () => {
            toast.success('Conexión verificada con Google Sheets')
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (mutationError: Error) =>
            toast.error(mutationError.message)
    })

    const syncMutation = useMutation({
        mutationFn: async () =>
            readJson(
                await fetch('/api/integrations/google-sheets/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationId: integration?.id })
                })
            ),
        onSuccess: () => {
            setSyncing(false)
            toast.success(
                'Sincronización iniciada. Los leads se prepararán y procesarán por lotes.'
            )
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (mutationError: Error) => {
            setSyncing(false)
            toast.error(mutationError.message)
        }
    })

    const retryMutation = useMutation({
        mutationFn: async () =>
            readJson(
                await fetch('/api/integrations/google-sheets/retry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationId: integration?.id })
                })
            ),
        onSuccess: (result: { retried: number }) => {
            toast.success(
                result.retried > 0
                    ? `${result.retried} sincronizaciones reencoladas`
                    : 'No había sincronizaciones fallidas'
            )
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (mutationError: Error) =>
            toast.error(mutationError.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async () =>
            readJson(
                await fetch('/api/integrations/google-sheets', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationId: integration?.id })
                })
            ) as Promise<IntegrationsResponse>,
        onSuccess: (result) => {
            queryClient.setQueryData(queryKey, result)
            setDeleting(false)
            toast.success('Integración eliminada')
            router.push('/admin/integrations/google-sheets')
        },
        onError: (mutationError: Error) => {
            setDeleting(false)
            toast.error(mutationError.message)
        }
    })

    const failedTotal = integration
        ? integration.status.failed + integration.status.dead
        : 0
    const inFlight = integration ? isInFlight(integration) : false
    const fieldsChanged = integration
        ? !sameLeadFields(form.fields, integration.fields)
        : false
    const script = scriptQuery.data

    function downloadScript() {
        if (!script) return
        const blob = new Blob([script.code], {
            type: 'text/javascript;charset=utf-8'
        })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = script.filename
        anchor.click()
        URL.revokeObjectURL(url)
    }

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((current) => ({ ...current, [key]: value }))
    }

    return (
        <div className='space-y-6'>
            <div>
                <Link
                    href='/admin/integrations/google-sheets'
                    className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                    <ArrowLeft className='size-4' />
                    Integraciones
                </Link>
            </div>

            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='flex items-start gap-3'>
                    <div className='rounded-lg bg-primary/10 p-2 text-primary'>
                        <FileCode2 className='size-5' />
                    </div>
                    <div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='text-xl font-semibold'>
                                {integration ? integration.name : 'Nueva integración'}
                            </h1>
                            {integration && (
                                <Badge
                                    variant={
                                        integration.enabled
                                            ? 'default'
                                            : 'secondary'
                                    }>
                                    {integration.enabled
                                        ? 'Activa'
                                        : 'Inactiva'}
                                </Badge>
                            )}
                        </div>
                        <p className='text-sm text-muted-foreground'>
                            {integration
                                ? 'Elegí los campos, guardá y copiá el código generado para Google Apps Script.'
                                : 'Configurá una hoja nueva. Después de guardar vas a poder copiar el código de Apps Script y las instrucciones.'}
                        </p>
                        {integration && (
                            <p className='mt-1 text-xs text-muted-foreground'>
                                Última sincronización:{' '}
                                <span className='text-foreground'>
                                    {formatDate(integration.status.lastSuccessAt)}
                                </span>
                                {' · '}Última prueba:{' '}
                                <span className='text-foreground'>
                                    {formatDate(integration.lastTestedAt)}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <Button
                        variant='outline'
                        onClick={() => testMutation.mutate()}
                        disabled={
                            testMutation.isPending || !form.webAppUrl.trim()
                        }>
                        <PlugZap />
                        {testMutation.isPending
                            ? 'Probando…'
                            : 'Probar conexión'}
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={
                            saveMutation.isPending ||
                            !payload.encryptionConfigured ||
                            (!form.syncCustomers && !form.syncTravel) ||
                            form.fields.length === 0
                        }>
                        <Save />
                        {saveMutation.isPending
                            ? 'Guardando…'
                            : integration
                              ? 'Guardar cambios'
                              : 'Crear integración'}
                    </Button>
                </div>
            </div>

            {!payload.encryptionConfigured && (
                <div className='flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                    <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                    <div>
                        Falta la variable de entorno{' '}
                        <code className='font-mono'>
                            GOOGLE_SHEETS_ENCRYPTION_KEY
                        </code>
                        . Sin ella no se puede cifrar ni guardar la clave
                        secreta.
                    </div>
                </div>
            )}

            {integration &&
                (integration.status.lastError || integration.lastError) && (
                    <div className='rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                        <p className='font-medium'>Último error</p>
                        <p>
                            {integration.status.lastError ||
                                integration.lastError}
                        </p>
                    </div>
                )}

            <Tabs defaultValue='config' className='gap-4'>
                <TabsList variant='line'>
                    <TabsTrigger value='config'>Configuración</TabsTrigger>
                    <TabsTrigger value='fields'>Campos a sincronizar</TabsTrigger>
                    {integration && (
                        <TabsTrigger value='script'>
                            Instalar en Google Sheets
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value='config' className='space-y-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Datos de la integración</CardTitle>
                            <CardDescription>
                                Cada integración apunta a su propia hoja y tiene
                                su propia URL y clave secreta.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-5'>
                            <div className='space-y-2'>
                                <Label htmlFor='gs-name'>Nombre</Label>
                                <Input
                                    id='gs-name'
                                    value={form.name}
                                    onChange={(event) =>
                                        update('name', event.target.value)
                                    }
                                    placeholder='Ej. Contactos – Hoja comercial'
                                    autoComplete='off'
                                />
                                <p className='text-xs text-muted-foreground'>
                                    Se usa en la lista y en el nombre del archivo
                                    de Apps Script.
                                </p>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='gs-url'>
                                    URL del Google Apps Script
                                </Label>
                                <Input
                                    id='gs-url'
                                    value={form.webAppUrl}
                                    onChange={(event) =>
                                        update('webAppUrl', event.target.value)
                                    }
                                    placeholder='https://script.google.com/macros/s/…/exec'
                                    autoComplete='off'
                                />
                                <p className='text-xs text-muted-foreground'>
                                    Debe terminar en <code>/exec</code>. La
                                    encontrás en Implementar → Gestionar
                                    implementaciones.
                                </p>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='gs-secret'>Clave secreta</Label>
                                <PasswordInput
                                    id='gs-secret'
                                    value={form.secret}
                                    onChange={(event) =>
                                        update('secret', event.target.value)
                                    }
                                    placeholder={
                                        integration?.hasSecret
                                            ? '•••••••• (clave guardada)'
                                            : 'La misma clave de API_SECRET en Apps Script'
                                    }
                                    autoComplete='new-password'
                                />
                                <p className='text-xs text-muted-foreground'>
                                    {integration?.hasSecret
                                        ? 'Ya hay una clave guardada. Dejá el campo vacío para conservarla, o escribí una nueva y actualizá API_SECRET en Apps Script.'
                                        : 'Se cifra con AES-256-GCM antes de guardarse. Debe coincidir con API_SECRET en Apps Script.'}
                                </p>
                            </div>

                            <div className='grid gap-4 sm:grid-cols-2'>
                                <div className='space-y-2'>
                                    <Label htmlFor='gs-attempts'>
                                        Reintentos por trabajo
                                    </Label>
                                    <Input
                                        id='gs-attempts'
                                        type='number'
                                        min={1}
                                        max={50}
                                        value={form.maxAttempts}
                                        onChange={(event) =>
                                            update(
                                                'maxAttempts',
                                                Number(event.target.value) || 1
                                            )
                                        }
                                    />
                                </div>

                                <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
                                    <div>
                                        <Label htmlFor='gs-enabled'>
                                            Sincronización activa
                                        </Label>
                                        <p className='text-xs text-muted-foreground'>
                                            Si está desactivada no se procesan
                                            los cambios pendientes.
                                        </p>
                                    </div>
                                    <Switch
                                        id='gs-enabled'
                                        checked={form.enabled}
                                        onCheckedChange={(enabled) =>
                                            update('enabled', Boolean(enabled))
                                        }
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className='grid gap-4 lg:grid-cols-2'>
                        <Card>
                            <CardHeader>
                                <div className='flex items-center justify-between gap-4'>
                                    <div>
                                        <CardTitle>Sincronizar contactos</CardTitle>
                                        <CardDescription>
                                            Leads del módulo de contactos.
                                        </CardDescription>
                                    </div>
                                    <Switch
                                        checked={form.syncCustomers}
                                        onCheckedChange={(checked) =>
                                            update(
                                                'syncCustomers',
                                                Boolean(checked)
                                            )
                                        }
                                    />
                                </div>
                            </CardHeader>
                            {form.syncCustomers && (
                                <CardContent>
                                    <StatusPicker
                                        label='Estados de contactos'
                                        hint='Sin selección se exportan todos los estados.'
                                        options={statuses.customer}
                                        selected={form.customerStatusIds}
                                        onChange={(ids) =>
                                            update('customerStatusIds', ids)
                                        }
                                    />
                                </CardContent>
                            )}
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className='flex items-center justify-between gap-4'>
                                    <div>
                                        <CardTitle>Sincronizar viajes</CardTitle>
                                        <CardDescription>
                                            Leads del módulo de viajes.
                                        </CardDescription>
                                    </div>
                                    <Switch
                                        checked={form.syncTravel}
                                        onCheckedChange={(checked) =>
                                            update('syncTravel', Boolean(checked))
                                        }
                                    />
                                </div>
                            </CardHeader>
                            {form.syncTravel && (
                                <CardContent>
                                    <StatusPicker
                                        label='Estados de viajes'
                                        hint='Sin selección se exportan todos los estados.'
                                        options={statuses.travel}
                                        selected={form.travelStatusIds}
                                        onChange={(ids) =>
                                            update('travelStatusIds', ids)
                                        }
                                    />
                                </CardContent>
                            )}
                        </Card>
                    </div>

                    {integration && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Sincronización manual</CardTitle>
                                <CardDescription>
                                    La sincronización completa revisa todos los
                                    leads de la organización y exporta solo los
                                    que coinciden con las fuentes y estados
                                    elegidos. Las filas que ya no coincidan se
                                    eliminan de esta hoja.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                <div className='grid grid-cols-3 gap-2 rounded-lg border p-3 text-center'>
                                    <div>
                                        <p className='text-lg font-semibold'>
                                            {integration.status.pending}
                                        </p>
                                        <p className='text-[11px] text-muted-foreground'>
                                            Pendientes
                                        </p>
                                    </div>
                                    <div>
                                        <p className='text-lg font-semibold'>
                                            {integration.status.processing}
                                        </p>
                                        <p className='text-[11px] text-muted-foreground'>
                                            Procesando
                                        </p>
                                    </div>
                                    <div>
                                        <p
                                            className={
                                                failedTotal > 0
                                                    ? 'text-lg font-semibold text-destructive'
                                                    : 'text-lg font-semibold'
                                            }>
                                            {failedTotal}
                                        </p>
                                        <p className='text-[11px] text-muted-foreground'>
                                            Fallidas
                                        </p>
                                    </div>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        onClick={() => setSyncing(true)}
                                        disabled={
                                            !integration.enabled ||
                                            syncMutation.isPending ||
                                            inFlight
                                        }>
                                        <RefreshCw />
                                        Sincronizar todo
                                    </Button>
                                    <Button
                                        variant='outline'
                                        onClick={() => retryMutation.mutate()}
                                        disabled={
                                            retryMutation.isPending ||
                                            failedTotal === 0
                                        }>
                                        <RotateCcw />
                                        Reintentar fallidas
                                    </Button>
                                </div>
                                <p className='text-xs text-muted-foreground'>
                                    Los cambios normales se encolan al guardar y
                                    se envían poco después. Los reintentos usan
                                    backoff exponencial.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {integration && (
                        <Card className='border-destructive/30'>
                            <CardHeader>
                                <CardTitle className='text-destructive'>
                                    Eliminar integración
                                </CardTitle>
                                <CardDescription>
                                    Se borra la configuración y su cola de
                                    sincronización. Las filas ya escritas en
                                    Google Sheets no se modifican.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant='destructive'
                                    onClick={() => setDeleting(true)}>
                                    <Trash2 />
                                    Eliminar integración
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value='fields' className='space-y-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Campos que se exportan</CardTitle>
                            <CardDescription>
                                El CRM siempre envía los cinco datos al script;
                                esta selección define qué columnas se muestran
                                en la hoja y en qué orden.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <FieldPicker
                                selected={form.fields}
                                onChange={(fields) => update('fields', fields)}
                            />

                            {fieldsChanged && (
                                <div className='flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400'>
                                    <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                                    <div className='space-y-1'>
                                        <p className='font-medium'>
                                            Guardá para regenerar el código
                                        </p>
                                        <p>
                                            Después de guardar, volvé a copiar y
                                            publicar el script en Apps Script. Si
                                            el orden o la cantidad de columnas
                                            cambió y la pestaña “Leads” ya tiene
                                            datos, archivá o eliminá esa pestaña
                                            y creá una nueva vacía antes de
                                            sincronizar; de lo contrario el
                                            script responderá LAYOUT_MISMATCH.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className='flex items-start gap-2 rounded-lg border p-3 text-sm text-muted-foreground'>
                                <CheckCircle2 className='mt-0.5 size-4 shrink-0' />
                                <p>
                                    Cambiar los campos no reinicia los cursores
                                    de sincronización. Los datos existentes se
                                    completan al volver a publicar el script y
                                    ejecutar una sincronización manual.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {integration && (
                    <TabsContent value='script' className='space-y-4'>
                        {scriptQuery.isLoading || scriptRefreshing ? (
                            <GlobeLoader
                                fullScreen={false}
                                className='py-16'
                                size={100}
                            />
                        ) : scriptQuery.error || !script ? (
                            <Card>
                                <CardContent className='flex items-center gap-2 py-8 text-sm text-destructive'>
                                    <AlertTriangle className='size-4' />
                                    {scriptQuery.error instanceof Error
                                        ? scriptQuery.error.message
                                        : 'No se pudo generar el código'}
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='flex items-center gap-2'>
                                            <Sparkles className='size-4' />
                                            Código para Google Apps Script
                                        </CardTitle>
                                        <CardDescription>
                                            Este código ya incluye la
                                            organización y las columnas
                                            elegidas. No contiene secretos: la
                                            clave se configura en las propiedades
                                            del script.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-3'>
                                        {fieldsChanged && (
                                            <div className='flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400'>
                                                <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                                                Guardá los cambios de campos para
                                                que este código incluya la
                                                selección nueva.
                                            </div>
                                        )}
                                        <CodeBlock>
                                            <CodeBlockHeader>
                                                <CodeBlockTitle>
                                                    {script.filename}
                                                </CodeBlockTitle>
                                                <CodeBlockActions>
                                                    <CodeBlockCopyButton
                                                        value={script.code}
                                                    />
                                                </CodeBlockActions>
                                            </CodeBlockHeader>
                                            <CodeBlockContent className='max-h-[480px]'>
                                                {script.code}
                                            </CodeBlockContent>
                                        </CodeBlock>
                                        <div className='flex flex-wrap gap-2'>
                                            <Button
                                                variant='outline'
                                                onClick={downloadScript}>
                                                <Download />
                                                Descargar {script.filename}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className='flex items-center gap-2'>
                                            <KeyRound className='size-4' />
                                            Propiedades del script
                                        </CardTitle>
                                        <CardDescription>
                                            En Apps Script abrí{' '}
                                            <strong>
                                                Configuración del proyecto
                                            </strong>{' '}
                                            → <strong>Propiedades del script</strong>{' '}
                                            → <strong>Agregar propiedad</strong> y
                                            creá estas tres entradas. Los nombres
                                            distinguen mayúsculas y no llevan
                                            espacios.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {script.properties.map((property) => (
                                            <PropertyRow
                                                key={property.key}
                                                property={property}
                                            />
                                        ))}
                                        <div className='mt-4 space-y-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground'>
                                            <p>
                                                <strong className='text-foreground'>
                                                    SPREADSHEET_ID:
                                                </strong>{' '}
                                                abrilo desde la URL de tu hoja:
                                                https://docs.google.com/spreadsheets/d/
                                                <strong className='text-foreground'>
                                                    ESTE_ES_EL_ID
                                                </strong>
                                                /edit
                                            </p>
                                            <p>
                                                <strong className='text-foreground'>
                                                    API_SECRET:
                                                </strong>{' '}
                                                usá exactamente la misma clave
                                                que guardaste en el campo “Clave
                                                secreta” de esta integración. Si
                                                no la recordás, escribí una nueva
                                                en Configuración, guardá y
                                                actualizá también esta propiedad.
                                            </p>
                                            <p>
                                                <strong className='text-foreground'>
                                                    ORGANIZATION_ID:
                                                </strong>{' '}
                                                ya viene completo; copialo tal
                                                cual.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className='flex items-center gap-2'>
                                            <ListChecks className='size-4' />
                                            Pasos para publicarlo
                                        </CardTitle>
                                        <CardDescription>
                                            Seguí el orden para que la primera
                                            sincronización funcione.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ol className='space-y-3'>
                                            {script.steps.map((step, index) => (
                                                <li
                                                    key={step}
                                                    className='flex gap-3 text-sm'>
                                                    <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary'>
                                                        {index + 1}
                                                    </span>
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                        <div className='mt-4 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400'>
                                            <p className='font-medium'>
                                                Si ya tenías una hoja con datos
                                            </p>
                                            <p>
                                                El script verifica que los
                                                encabezados coincidan con los
                                                campos elegidos. Si cambiaron,
                                                archivá o eliminá la pestaña
                                                “Leads” y creá una nueva vacía;
                                                después ejecutá “Sincronizar
                                                todo”. La pestaña “_CRM_SYNC” no
                                                se debe borrar mientras haya
                                                trabajos pendientes.
                                            </p>
                                        </div>
                                        <div className='mt-4 flex flex-wrap gap-2'>
                                            <a
                                                href='https://script.google.com/home'
                                                target='_blank'
                                                rel='noreferrer'
                                                className={buttonVariants({
                                                    variant: 'outline'
                                                })}>
                                                Abrir Google Apps Script
                                            </a>
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    scriptQuery.refetch()
                                                }
                                                disabled={
                                                    scriptQuery.isFetching
                                                }>
                                                <RefreshCw />
                                                Regenerar vista previa
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>
                )}
            </Tabs>

            <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
                <p className='text-xs text-muted-foreground'>
                    ORGANIZATION_ID:{' '}
                    <code className='font-mono text-foreground'>
                        {organizationId}
                    </code>
                    {integration && (
                        <>
                            {' · '}
                            Estados de contactos:{' '}
                            {statusSummary(
                                form.customerStatusIds,
                                statuses.customer
                            )}
                            {' · '}
                            Estados de viajes:{' '}
                            {statusSummary(
                                form.travelStatusIds,
                                statuses.travel
                            )}
                        </>
                    )}
                </p>
                <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={
                        saveMutation.isPending ||
                        !payload.encryptionConfigured ||
                        (!form.syncCustomers && !form.syncTravel) ||
                        form.fields.length === 0
                    }>
                    <Save />
                    {saveMutation.isPending
                        ? 'Guardando…'
                        : integration
                          ? 'Guardar cambios'
                          : 'Crear integración'}
                </Button>
            </div>

            <AlertDialog open={syncing} onOpenChange={setSyncing}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Sincronizar toda la hoja?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Se revisarán los leads de la organización y se
                            exportarán solo los que coincidan con las fuentes y
                            estados seleccionados. Las filas que ya no coincidan
                            se eliminarán de esta hoja. El proceso puede tardar
                            varios minutos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button
                            variant='outline'
                            onClick={() => setSyncing(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => syncMutation.mutate()}
                            disabled={syncMutation.isPending}>
                            {syncMutation.isPending
                                ? 'Encolando…'
                                : 'Sincronizar'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleting} onOpenChange={setDeleting}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Eliminar esta integración?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Se borrará la configuración y su cola de
                            sincronización. Las filas ya escritas en Google
                            Sheets no se modifican.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button
                            variant='outline'
                            onClick={() => setDeleting(false)}>
                            Cancelar
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending
                                ? 'Eliminando…'
                                : 'Eliminar'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
