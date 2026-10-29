'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { LeadField } from '@/lib/integrations/google-sheets-fields'

export interface SyncStatus {
    scanning: boolean
    pending: number
    processing: number
    failed: number
    dead: number
    lastSuccessAt: string | null
    lastError: string | null
}

export interface StatusOption {
    id: number
    name: string
    color: string | null
    isActive: boolean
}

export interface Integration {
    id: number
    organizationId: string
    name: string
    enabled: boolean
    webAppUrl: string
    hasSecret: boolean
    maxAttempts: number
    syncCustomers: boolean
    syncTravel: boolean
    customerStatusIds: number[]
    travelStatusIds: number[]
    fields: LeadField[]
    lastSuccessAt: string | null
    lastError: string | null
    lastTestedAt: string | null
    status: SyncStatus
}

export interface IntegrationsResponse {
    integrations: Integration[]
    customerStatuses: StatusOption[]
    travelStatuses: StatusOption[]
    encryptionConfigured: boolean
    createdIntegrationId?: number
}

export async function readJson(response: Response) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(
            typeof data?.error === 'string'
                ? data.error
                : 'La operación falló'
        )
    }
    return data
}

export function formatDate(value: string | null): string {
    if (!value) return 'Nunca'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Nunca'
    return new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date)
}

export function statusSummary(ids: number[], options: StatusOption[]): string {
    if (!ids.length) return 'Todos los estados'
    return ids
        .map((id) => options.find((option) => option.id === id)?.name ?? `#${id}`)
        .join(', ')
}

export function isInFlight(integration: Integration): boolean {
    return (
        integration.status.pending > 0 ||
        integration.status.processing > 0 ||
        integration.status.failed > 0 ||
        integration.status.scanning
    )
}

export function StatusPicker({
    label,
    hint,
    options,
    selected,
    onChange
}: {
    label: string
    hint: string
    options: StatusOption[]
    selected: number[]
    onChange: (ids: number[]) => void
}) {
    function toggle(id: number, checked: boolean) {
        onChange(
            checked
                ? Array.from(new Set([...selected, id]))
                : selected.filter((value) => value !== id)
        )
    }

    return (
        <div className='space-y-2'>
            <div className='flex items-center justify-between gap-3'>
                <Label>{label}</Label>
                <button
                    type='button'
                    className='text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
                    onClick={() => onChange([])}>
                    Todos
                </button>
            </div>
            <div className='grid max-h-44 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2'>
                {options.length === 0 && (
                    <p className='text-xs text-muted-foreground'>
                        No hay estados disponibles.
                    </p>
                )}
                {options.map((option) => (
                    <label
                        key={option.id}
                        className='flex cursor-pointer items-center gap-2 text-sm'>
                        <Checkbox
                            checked={selected.includes(option.id)}
                            onCheckedChange={(checked) =>
                                toggle(option.id, Boolean(checked))
                            }
                        />
                        <span
                            className='size-2.5 shrink-0 rounded-full border'
                            style={{
                                backgroundColor: option.color ?? '#6b7280'
                            }}
                        />
                        <span className='truncate'>{option.name}</span>
                        {!option.isActive && (
                            <span className='text-[10px] text-muted-foreground'>
                                (inactivo)
                            </span>
                        )}
                    </label>
                ))}
            </div>
            <p className='text-xs text-muted-foreground'>{hint}</p>
        </div>
    )
}
