'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    ArrowRight,
    FileSpreadsheet,
    Plus
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Switch } from '@/components/ui/switch'
import {
    formatDate,
    isInFlight,
    readJson,
    statusSummary,
    type IntegrationsResponse
} from '@/components/integrations/google-sheets-shared'
import { LEAD_FIELD_LABELS } from '@/lib/integrations/google-sheets-fields'

export function GoogleSheetsList({ organizationId }: { organizationId: string }) {
    const queryKey = ['google-sheets-integrations', organizationId] as const
    const queryClient = useQueryClient()

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

    const toggleMutation = useMutation({
        mutationFn: async ({
            integrationId,
            enabled
        }: {
            integrationId: number
            enabled: boolean
        }) =>
            readJson(
                await fetch('/api/integrations/google-sheets', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: integrationId, enabled })
                })
            ) as Promise<IntegrationsResponse>,
        onSuccess: (payload) => queryClient.setQueryData(queryKey, payload),
        onError: (mutationError: Error) => toast.error(mutationError.message)
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

    const statuses = {
        customer: data.customerStatuses,
        travel: data.travelStatuses
    }

    return (
        <div className='space-y-6'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='flex items-start gap-3'>
                    <div className='rounded-lg bg-primary/10 p-2 text-primary'>
                        <FileSpreadsheet className='size-5' />
                    </div>
                    <div>
                        <h1 className='text-xl font-semibold'>
                            Integraciones con Google Sheets
                        </h1>
                        <p className='text-sm text-muted-foreground'>
                            Sincronización unidireccional CRM → Google Sheets.
                            Podés conectar varias hojas y elegir qué leads,
                            estados y campos se exportan en cada una.
                        </p>
                    </div>
                </div>
                {data.encryptionConfigured ? (
                    <Link
                        href='/admin/integrations/google-sheets/new'
                        className={buttonVariants()}>
                        <Plus />
                        Nueva integración
                    </Link>
                ) : (
                    <span
                        className={buttonVariants({
                            className: 'pointer-events-none opacity-50'
                        })}>
                        <Plus />
                        Nueva integración
                    </span>
                )}
            </div>

            {!data.encryptionConfigured && (
                <div className='flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                    <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                    <div>
                        Falta la variable de entorno{' '}
                        <code className='font-mono'>
                            GOOGLE_SHEETS_ENCRYPTION_KEY
                        </code>
                        . Sin ella no se puede cifrar ni guardar la clave
                        secreta. Reiniciá el servidor después de configurarla.
                    </div>
                </div>
            )}

            {data.integrations.length === 0 ? (
                <Card>
                    <CardContent className='flex flex-col items-center gap-3 py-14 text-center'>
                        <div className='rounded-full bg-muted p-3'>
                            <FileSpreadsheet className='size-6 text-muted-foreground' />
                        </div>
                        <div>
                            <p className='font-medium'>
                                Todavía no hay integraciones
                            </p>
                            <p className='text-sm text-muted-foreground'>
                                Agregá una hoja para empezar a exportar contactos
                                o leads de viaje.
                            </p>
                        </div>
                        {data.encryptionConfigured && (
                            <Link
                                href='/admin/integrations/google-sheets/new'
                                className={buttonVariants()}>
                                <Plus />
                                Nueva integración
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className='grid gap-4 xl:grid-cols-2'>
                    {data.integrations.map((integration) => {
                        const failedTotal =
                            integration.status.failed + integration.status.dead
                        const inFlight = isInFlight(integration)
                        const toggling =
                            toggleMutation.isPending &&
                            toggleMutation.variables?.integrationId ===
                                integration.id

                        return (
                            <Card
                                key={integration.id}
                                className='relative transition-colors hover:border-primary/40'>
                                <Link
                                    href={`/admin/integrations/google-sheets/${integration.id}`}
                                    className='absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'>
                                    <span className='sr-only'>
                                        Abrir {integration.name}
                                    </span>
                                </Link>
                                <CardHeader>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <CardTitle className='truncate'>
                                                {integration.name}
                                            </CardTitle>
                                            <CardDescription className='truncate'>
                                                {integration.webAppUrl ||
                                                    'Sin URL configurada'}
                                            </CardDescription>
                                        </div>
                                        <div className='relative z-10 flex items-center gap-2'>
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
                                            <Switch
                                                checked={integration.enabled}
                                                disabled={toggling}
                                                aria-label={`Activar ${integration.name}`}
                                                onCheckedChange={(enabled) =>
                                                    toggleMutation.mutate({
                                                        integrationId:
                                                            integration.id,
                                                        enabled: Boolean(enabled)
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className='space-y-4 text-sm'>
                                    <div className='flex flex-wrap gap-2'>
                                        {integration.syncCustomers && (
                                            <Badge variant='outline'>
                                                Contactos
                                            </Badge>
                                        )}
                                        {integration.syncTravel && (
                                            <Badge variant='outline'>
                                                Viajes
                                            </Badge>
                                        )}
                                        <Badge variant='outline'>
                                            {integration.fields
                                                .map(
                                                    (field) =>
                                                        LEAD_FIELD_LABELS[field]
                                                )
                                                .join(' · ')}
                                        </Badge>
                                    </div>

                                    <div className='space-y-1 text-xs text-muted-foreground'>
                                        {integration.syncCustomers && (
                                            <p>
                                                <span className='font-medium text-foreground'>
                                                    Contactos:
                                                </span>{' '}
                                                {statusSummary(
                                                    integration.customerStatusIds,
                                                    statuses.customer
                                                )}
                                            </p>
                                        )}
                                        {integration.syncTravel && (
                                            <p>
                                                <span className='font-medium text-foreground'>
                                                    Viajes:
                                                </span>{' '}
                                                {statusSummary(
                                                    integration.travelStatusIds,
                                                    statuses.travel
                                                )}
                                            </p>
                                        )}
                                    </div>

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

                                    <div className='space-y-1 text-xs text-muted-foreground'>
                                        <p>
                                            Última sincronización:{' '}
                                            <span className='text-foreground'>
                                                {formatDate(
                                                    integration.status
                                                        .lastSuccessAt
                                                )}
                                            </span>
                                        </p>
                                        {inFlight ? (
                                            <p role='status'>
                                                {integration.status.scanning
                                                    ? 'Preparando leads por lotes… '
                                                    : ''}
                                                {integration.status.pending}{' '}
                                                pendientes;{' '}
                                                {integration.status.processing}{' '}
                                                procesando.
                                            </p>
                                        ) : (
                                            <p>Sin trabajos en cola.</p>
                                        )}
                                    </div>

                                    {(integration.status.lastError ||
                                        integration.lastError) && (
                                        <div className='line-clamp-2 rounded-md bg-destructive/5 p-2 text-xs text-destructive'>
                                            {integration.status.lastError ||
                                                integration.lastError}
                                        </div>
                                    )}

                                    <div className='flex items-center justify-between border-t pt-3 text-sm font-medium text-primary'>
                                        <span>Configurar, campos y Apps Script</span>
                                        <ArrowRight className='size-4' />
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
