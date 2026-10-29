import {
    createCipheriv,
    createDecipheriv,
    randomUUID,
    randomBytes
} from 'node:crypto'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { after } from 'next/server'

import { db } from '@/db'
import { member } from '@/auth-schema'
import {
    normalizeLeadFields,
    parseLeadFields,
    serializeLeadFields,
    type LeadField
} from './google-sheets-fields'
import { normalizeAppsScriptUrl, postToAppsScript, SheetsError } from './google-sheets-transport'
import {
    customerNotes,
    customers,
    googleSheetsIntegrations,
    googleSheetsSyncJobs,
    status,
    travelLeadNotes,
    travelLeads,
    travelStatuses
} from '@/db/schema'

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export const LEAD_SOURCES = ['customer', 'travel'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export {
    LEAD_FIELD_DESCRIPTIONS,
    LEAD_FIELD_LABELS,
    LEAD_FIELDS,
    isLeadField,
    sameLeadFields,
    type LeadField
} from './google-sheets-fields'
export { normalizeLeadFields, parseLeadFields, serializeLeadFields }

export type SyncOperation = 'upsert' | 'delete'

export interface GoogleSheetsSyncStatus {
    pending: number
    scanning: boolean
    processing: number
    failed: number
    dead: number
    lastSuccessAt: string | null
    lastError: string | null
}

export interface GoogleSheetsIntegrationSnapshot {
    id: number
    organizationId: string
    name: string
    enabled: boolean
    webAppUrl: string
    hasSecret: boolean
    maxAttempts: number
    syncCustomers: boolean
    syncTravel: boolean
    /** Empty means every status is exported. */
    customerStatusIds: number[]
    /** Empty means every status is exported. */
    travelStatusIds: number[]
    /** Selected columns, in stable order. Empty means every field. */
    fields: LeadField[]
    lastSuccessAt: string | null
    lastError: string | null
    lastTestedAt: string | null
    status: GoogleSheetsSyncStatus
}

export interface GoogleSheetsStatusOption {
    id: number
    name: string
    color: string | null
    isActive: boolean
}

export interface GoogleSheetsStatusOptions {
    customers: GoogleSheetsStatusOption[]
    travel: GoogleSheetsStatusOption[]
}

export interface LeadSnapshot {
    publicId: string
    name: string
    phone: string
    email: string
    notes: string
    status: string
    statusId: number | null
}

interface ClaimedJob {
    id: number
    organizationId: string
    integrationId: number
    leadSource: LeadSource
    leadId: number
    operation: SyncOperation
    attempts: number
    version: number
    leaseToken: string
}

type IntegrationRow = typeof googleSheetsIntegrations.$inferSelect

/** Only call after validating membership with organizationAccess(). */
export async function getOrganizationId(session: {
    user: { id: string }
    session?: { activeOrganizationId?: string | null } | null
} | null): Promise<string> {
    if (!session) throw new SheetsError('Seleccioná una organización activa.')
    const active = session.session?.activeOrganizationId?.trim()
    if (active) return active

    const memberships = await db
        .select({ id: member.organizationId })
        .from(member)
        .where(eq(member.userId, session.user.id))
    if (memberships.length === 1) return memberships[0].id

    throw new SheetsError('Seleccioná una organización activa.')
}

/* -------------------------------------------------------------------------- */
/*                             Secret encryption                              */
/* -------------------------------------------------------------------------- */

function encryptionKey(): Buffer {
    const raw = process.env.GOOGLE_SHEETS_ENCRYPTION_KEY?.trim()

    if (!raw) {
        throw new SheetsError(
            'Falta GOOGLE_SHEETS_ENCRYPTION_KEY. Configurá una clave de 32 bytes (hex o base64) antes de guardar el secreto.'
        )
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex')
    }

    const asBase64 = Buffer.from(raw, 'base64')
    if (asBase64.length === 32) {
        return asBase64
    }

    throw new SheetsError('GOOGLE_SHEETS_ENCRYPTION_KEY debe contener 32 bytes en hex o base64.')
}

export function isSecretEncryptionConfigured(): boolean {
    try {
        encryptionKey()
        return true
    } catch {
        return false
    }
}

function encryptSecret(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
    const encrypted = Buffer.concat([
        cipher.update(plain, 'utf8'),
        cipher.final()
    ])
    const tag = cipher.getAuthTag()

    return [
        'v1',
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url')
    ].join('.')
}

function decryptSecret(payload: string): string {
    const [version, iv, tag, data] = payload.split('.')
    if (version !== 'v1' || !iv || !tag || !data) {
        throw new SheetsError('La clave secreta guardada tiene un formato inválido.')
    }

    try {
        const decipher = createDecipheriv(
            'aes-256-gcm',
            encryptionKey(),
            Buffer.from(iv, 'base64url')
        )
        decipher.setAuthTag(Buffer.from(tag, 'base64url'))
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(data, 'base64url')),
            decipher.final()
        ])
        return decrypted.toString('utf8')
    } catch {
        throw new SheetsError(
            'No se pudo descifrar la clave secreta. Volvé a guardarla con la clave de cifrado actual.'
        )
    }
}

/* -------------------------------------------------------------------------- */
/*                              URL validation                                */
/* -------------------------------------------------------------------------- */

export { normalizeAppsScriptUrl } from './google-sheets-transport'

/* -------------------------------------------------------------------------- */
/*                        Settings / filter helpers                           */
/* -------------------------------------------------------------------------- */

const DEFAULT_INTEGRATION_NAME = 'Integración'

function normalizeName(value: string | undefined): string {
    const name = value?.trim().replace(/\s+/g, ' ')
    return name ? name.slice(0, 80) : DEFAULT_INTEGRATION_NAME
}

function parseStatusIds(value: string | null | undefined): number[] {
    if (!value) return []
    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) return []
        return Array.from(
            new Set(
                parsed
                    .map(Number)
                    .filter((id) => Number.isSafeInteger(id) && id > 0)
            )
        )
    } catch {
        return []
    }
}

function serializeStatusIds(ids: number[]): string | null {
    return ids.length ? JSON.stringify(ids) : null
}

function sameIds(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every((id) => set.has(id))
}

function normalizeStatusIdsInput(value: number[] | undefined): number[] | undefined {
    if (value === undefined) return undefined
    if (!Array.isArray(value)) {
        throw new SheetsError('La selección de estados no es válida.')
    }
    return Array.from(
        new Set(
            value
                .map(Number)
                .filter((id) => Number.isSafeInteger(id) && id > 0)
        )
    )
}

function normalizeMaxAttempts(value: number | undefined, fallback: number): number {
    if (value === undefined) return fallback
    if (!Number.isInteger(value) || value < 1 || value > 50) {
        throw new SheetsError('El máximo de intentos debe estar entre 1 y 50.')
    }
    return value
}

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null
}

function toSnapshot(
    row: IntegrationRow,
    status: GoogleSheetsSyncStatus
): GoogleSheetsIntegrationSnapshot {
    return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        enabled: Boolean(row.enabled),
        webAppUrl: row.webAppUrl,
        hasSecret: Boolean(row.secretEncrypted),
        maxAttempts: row.maxAttempts,
        syncCustomers: Boolean(row.syncCustomers),
        syncTravel: Boolean(row.syncTravel),
        customerStatusIds: parseStatusIds(row.customerStatusIds),
        travelStatusIds: parseStatusIds(row.travelStatusIds),
        fields: parseLeadFields(row.fields),
        lastSuccessAt: toIso(row.lastSuccessAt),
        lastError: row.lastError ?? null,
        lastTestedAt: toIso(row.lastTestedAt),
        status
    }
}

function emptyStatus(row?: IntegrationRow | null): GoogleSheetsSyncStatus {
    return {
        pending: 0,
        scanning: Boolean(
            row && (row.customerCursor !== null || row.travelCursor !== null)
        ),
        processing: 0,
        failed: 0,
        dead: 0,
        lastSuccessAt: toIso(row?.lastSuccessAt),
        lastError: row?.lastError ?? null
    }
}

export async function getGoogleSheetsStatusOptions(): Promise<GoogleSheetsStatusOptions> {
    const [customerRows, travelRows] = await Promise.all([
        db
            .select({
                id: status.id,
                name: status.status,
                color: status.color,
                isActive: status.isActive
            })
            .from(status)
            .orderBy(status.id),
        db
            .select({
                id: travelStatuses.id,
                name: travelStatuses.status,
                color: travelStatuses.color,
                isActive: travelStatuses.isActive
            })
            .from(travelStatuses)
            .orderBy(travelStatuses.id)
    ])

    const normalize = (rows: typeof customerRows) =>
        rows.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color ?? null,
            isActive: Boolean(row.isActive)
        }))

    return { customers: normalize(customerRows), travel: normalize(travelRows) }
}

async function getIntegrationRow(
    organizationId: string,
    integrationId: number
): Promise<IntegrationRow | null> {
    const [row] = await db
        .select()
        .from(googleSheetsIntegrations)
        .where(
            and(
                eq(googleSheetsIntegrations.organizationId, organizationId),
                eq(googleSheetsIntegrations.id, integrationId)
            )
        )
        .limit(1)

    return row ?? null
}

async function getIntegrationRowById(
    integrationId: number
): Promise<IntegrationRow | null> {
    const [row] = await db
        .select()
        .from(googleSheetsIntegrations)
        .where(eq(googleSheetsIntegrations.id, integrationId))
        .limit(1)
    return row ?? null
}

async function loadStatuses(
    organizationId: string,
    integrationIds: number[]
): Promise<Map<number, GoogleSheetsSyncStatus>> {
    const map = new Map<number, GoogleSheetsSyncStatus>()
    if (!integrationIds.length) return map

    const grouped = await db
        .select({
            integrationId: googleSheetsSyncJobs.integrationId,
            status: googleSheetsSyncJobs.status,
            total: sql<number>`count(*)`
        })
        .from(googleSheetsSyncJobs)
        .where(
            and(
                eq(googleSheetsSyncJobs.organizationId, organizationId),
                eq(googleSheetsSyncJobs.protocol, 2),
                inArray(googleSheetsSyncJobs.integrationId, integrationIds)
            )
        )
        .groupBy(
            googleSheetsSyncJobs.integrationId,
            googleSheetsSyncJobs.status
        )

    for (const entry of grouped) {
        if (entry.integrationId === null) continue
        let current = map.get(entry.integrationId)
        if (!current) {
            current = emptyStatus()
            map.set(entry.integrationId, current)
        }
        const total = Number(entry.total)
        if (entry.status === 'pending') current.pending = total
        else if (entry.status === 'processing') current.processing = total
        else if (entry.status === 'failed') current.failed = total
        else if (entry.status === 'dead') current.dead = total
    }

    return map
}

export async function listGoogleSheetsIntegrations(
    organizationId: string
): Promise<GoogleSheetsIntegrationSnapshot[]> {
    const rows = await db
        .select()
        .from(googleSheetsIntegrations)
        .where(eq(googleSheetsIntegrations.organizationId, organizationId))
        .orderBy(googleSheetsIntegrations.id)

    const statuses = await loadStatuses(
        organizationId,
        rows.map((row) => row.id)
    )

    return rows.map((row) => {
        const status = statuses.get(row.id) ?? emptyStatus(row)
        status.scanning =
            row.customerCursor !== null || row.travelCursor !== null
        status.lastSuccessAt = toIso(row.lastSuccessAt)
        status.lastError = row.lastError ?? null
        return toSnapshot(row, status)
    })
}

export async function getGoogleSheetsIntegration(
    organizationId: string,
    integrationId: number
): Promise<GoogleSheetsIntegrationSnapshot | null> {
    const row = await getIntegrationRow(organizationId, integrationId)
    if (!row) return null

    const statuses = await loadStatuses(organizationId, [row.id])
    const status = statuses.get(row.id) ?? emptyStatus(row)
    status.scanning =
        row.customerCursor !== null || row.travelCursor !== null
    status.lastSuccessAt = toIso(row.lastSuccessAt)
    status.lastError = row.lastError ?? null
    return toSnapshot(row, status)
}

async function getIntegrationSnapshotOrThrow(
    organizationId: string,
    integrationId: number
): Promise<GoogleSheetsIntegrationSnapshot> {
    const snapshot = await getGoogleSheetsIntegration(
        organizationId,
        integrationId
    )
    if (!snapshot) {
        throw new SheetsError('La integración no existe en esta organización.')
    }
    return snapshot
}

function requireConfiguration(
    enabled: boolean,
    webAppUrl: string,
    secretEncrypted: string | null
) {
    if (enabled && !webAppUrl) {
        throw new SheetsError(
            'Configurá la URL de Google Apps Script antes de activar la sincronización.'
        )
    }
    if (enabled && !secretEncrypted) {
        throw new SheetsError(
            'Configurá la clave secreta antes de activar la sincronización.'
        )
    }
}

export interface IntegrationInput {
    name?: string
    enabled?: boolean
    webAppUrl?: string
    secret?: string | null
    clearSecret?: boolean
    maxAttempts?: number
    syncCustomers?: boolean
    syncTravel?: boolean
    customerStatusIds?: number[]
    travelStatusIds?: number[]
    fields?: string[]
}

export async function createGoogleSheetsIntegration(
    organizationId: string,
    input: IntegrationInput
): Promise<GoogleSheetsIntegrationSnapshot> {
    const name = normalizeName(input.name)
    const enabled = input.enabled ?? false
    const webAppUrl = input.webAppUrl?.trim()
        ? normalizeAppsScriptUrl(input.webAppUrl)
        : ''
    const secretEncrypted = input.secret?.trim()
        ? encryptSecret(input.secret.trim())
        : null
    const maxAttempts = normalizeMaxAttempts(input.maxAttempts, 8)
    const syncCustomers = input.syncCustomers ?? true
    const syncTravel = input.syncTravel ?? true
    const customerStatusIds =
        normalizeStatusIdsInput(input.customerStatusIds) ?? []
    const travelStatusIds =
        normalizeStatusIdsInput(input.travelStatusIds) ?? []
    const fields = normalizeLeadFields(input.fields) ?? parseLeadFields(null)

    if (!syncCustomers && !syncTravel) {
        throw new SheetsError(
            'Seleccioná al menos un tipo de lead: contactos o viajes.'
        )
    }

    requireConfiguration(enabled, webAppUrl, secretEncrypted)

    const scan = enabled && Boolean(webAppUrl && secretEncrypted)
    const [row] = await db
        .insert(googleSheetsIntegrations)
        .values({
            organizationId,
            name,
            enabled,
            webAppUrl,
            secretEncrypted,
            maxAttempts,
            syncCustomers,
            syncTravel,
            customerStatusIds: serializeStatusIds(customerStatusIds),
            travelStatusIds: serializeStatusIds(travelStatusIds),
            fields: serializeLeadFields(fields),
            customerCursor: scan && syncCustomers ? 0 : null,
            travelCursor: scan && syncTravel ? 0 : null,
            lastSuccessAt: null
        })
        .returning()

    return getIntegrationSnapshotOrThrow(organizationId, row.id)
}

export async function updateGoogleSheetsIntegration(
    organizationId: string,
    integrationId: number,
    input: IntegrationInput
): Promise<GoogleSheetsIntegrationSnapshot> {
    const existing = await getIntegrationRow(organizationId, integrationId)
    if (!existing) {
        throw new SheetsError('La integración no existe en esta organización.')
    }

    const name = input.name !== undefined
        ? normalizeName(input.name)
        : existing.name
    const webAppUrl = input.webAppUrl !== undefined
        ? input.webAppUrl.trim()
            ? normalizeAppsScriptUrl(input.webAppUrl)
            : ''
        : existing.webAppUrl
    let secretEncrypted = existing.secretEncrypted
    if (input.clearSecret) {
        secretEncrypted = null
    } else if (input.secret !== undefined && input.secret !== null) {
        const secret = input.secret.trim()
        if (secret) secretEncrypted = encryptSecret(secret)
    }
    const enabled = input.enabled ?? Boolean(existing.enabled)
    const maxAttempts = normalizeMaxAttempts(
        input.maxAttempts,
        existing.maxAttempts
    )
    const syncCustomers = input.syncCustomers ?? Boolean(existing.syncCustomers)
    const syncTravel = input.syncTravel ?? Boolean(existing.syncTravel)
    const customerStatusIds = input.customerStatusIds !== undefined
        ? normalizeStatusIdsInput(input.customerStatusIds) ?? []
        : parseStatusIds(existing.customerStatusIds)
    const travelStatusIds = input.travelStatusIds !== undefined
        ? normalizeStatusIdsInput(input.travelStatusIds) ?? []
        : parseStatusIds(existing.travelStatusIds)
    const fields = input.fields !== undefined
        ? normalizeLeadFields(input.fields) ?? parseLeadFields(null)
        : parseLeadFields(existing.fields)

    if (!syncCustomers && !syncTravel) {
        throw new SheetsError(
            'Seleccioná al menos un tipo de lead: contactos o viajes.'
        )
    }

    requireConfiguration(enabled, webAppUrl, secretEncrypted)

    const urlChanged = webAppUrl !== existing.webAppUrl
    const enabledNow = enabled && !existing.enabled
    const baseRestart = urlChanged || enabledNow
    const customerFilterChanged =
        syncCustomers !== Boolean(existing.syncCustomers) ||
        !sameIds(customerStatusIds, parseStatusIds(existing.customerStatusIds))
    const travelFilterChanged =
        syncTravel !== Boolean(existing.syncTravel) ||
        !sameIds(travelStatusIds, parseStatusIds(existing.travelStatusIds))

    // A filter change or a new target sheet requires a full reconciliation:
    // matching leads are upserted and previously exported rows that no longer
    // match are deleted. Disabling a source also reconciles its deletions.
    const customerScan =
        (baseRestart || customerFilterChanged) &&
        (syncCustomers || Boolean(existing.syncCustomers))
    const travelScan =
        (baseRestart || travelFilterChanged) &&
        (syncTravel || Boolean(existing.syncTravel))

    await db
        .update(googleSheetsIntegrations)
        .set({
            name,
            enabled,
            webAppUrl,
            secretEncrypted,
            maxAttempts,
            syncCustomers,
            syncTravel,
            customerStatusIds: serializeStatusIds(customerStatusIds),
            travelStatusIds: serializeStatusIds(travelStatusIds),
            fields: serializeLeadFields(fields),
            ...(customerScan ? { customerCursor: 0 } : {}),
            ...(travelScan ? { travelCursor: 0 } : {}),
            ...(urlChanged ? { lastSuccessAt: null } : {}),
            updatedAt: new Date()
        })
        .where(eq(googleSheetsIntegrations.id, integrationId))

    return getIntegrationSnapshotOrThrow(organizationId, integrationId)
}

export async function deleteGoogleSheetsIntegration(
    organizationId: string,
    integrationId: number
): Promise<void> {
    const existing = await getIntegrationRow(organizationId, integrationId)
    if (!existing) {
        throw new SheetsError('La integración no existe en esta organización.')
    }

    await db
        .delete(googleSheetsSyncJobs)
        .where(eq(googleSheetsSyncJobs.integrationId, integrationId))
    await db
        .delete(googleSheetsIntegrations)
        .where(eq(googleSheetsIntegrations.id, integrationId))
}

/* -------------------------------------------------------------------------- */
/*                              Outbox enqueue                                */
/* -------------------------------------------------------------------------- */

/** Compatibility hooks only wake the worker. Database triggers persist changes
 * atomically, even when disabled or the process dies before this hook runs. */
export async function enqueueLeadSyncs(
    organizationId: string, source: LeadSource, leadIds: number[],
    operation: SyncOperation = 'upsert'
): Promise<number> {
    // No database/network work here: the trigger already persisted one job per
    // matching integration.
    return organizationId && LEAD_SOURCES.includes(source) && ['upsert', 'delete'].includes(operation)
        ? leadIds.length : 0
}
export async function enqueueLeadSync(organizationId: string, source: LeadSource, leadId: number, operation: SyncOperation = 'upsert') {
    return enqueueLeadSyncs(organizationId, source, [leadId], operation)
}
export async function enqueueLeadSyncForAllOrganizations(source: LeadSource, leadId: number) {
    const table = source === 'customer' ? customers : travelLeads
    const [row] = await db.select({ organizationId: table.organizationId }).from(table).where(eq(table.id, leadId))
    return row?.organizationId ? enqueueLeadSync(row.organizationId, source, leadId) : 0
}
export async function enqueueStatusRenameSync(kind: LeadSource, statusId: number) {
    // The status trigger already enqueued all affected integrations.
    return kind && statusId ? 1 : 0
}

/* -------------------------------------------------------------------------- */
/*                          Lead snapshot / payload                           */
/* -------------------------------------------------------------------------- */

const noteDateFormatter = new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
})

function formatNoteDate(value: Date | null): string | null {
    if (!value) return null
    try {
        return noteDateFormatter.format(value)
    } catch {
        return null
    }
}

function formatNotes(
    rows: { note: string; createdAt: Date | null }[]
): string {
    return rows
        .map((row) => {
            const text = row.note.trim()
            if (!text) return null
            const date = formatNoteDate(row.createdAt)
            return date ? `${date}: ${text}` : text
        })
        .filter((line): line is string => Boolean(line))
        .join('\n')
}

function leadPublicId(organizationId: string, source: LeadSource, id: number): string {
    return `${encodeURIComponent(organizationId)}:${source}:${id}`
}

function cleanName(value: string): string {
    return value.trim().replace(/\s+/g, ' ')
}

async function loadLeadSnapshot(
    organizationId: string,
    source: LeadSource,
    leadId: number
): Promise<LeadSnapshot | null> {
    if (source === 'customer') {
        const [row] = await db
            .select({
                id: customers.id,
                name: customers.name,
                phone: customers.phone,
                email: customers.email,
                statusId: customers.statusId,
                statusName: status.status
            })
            .from(customers)
            .leftJoin(status, eq(customers.statusId, status.id))
            .where(and(eq(customers.id, leadId), eq(customers.organizationId, organizationId)))
            .limit(1)

        if (!row) return null

        const notes = await db
            .select({
                note: customerNotes.note,
                createdAt: customerNotes.createdAt
            })
            .from(customerNotes)
            .where(eq(customerNotes.customerId, leadId))
            .orderBy(sql`${customerNotes.createdAt} DESC`)

        return {
            publicId: leadPublicId(organizationId, source, row.id),
            name: cleanName(row.name),
            phone: row.phone.trim(),
            email: row.email.trim(),
            notes: formatNotes(notes),
            status: row.statusName?.trim() || '',
            statusId: row.statusId ?? null
        }
    }

    const [row] = await db
        .select({
            id: travelLeads.id,
            name: travelLeads.name,
            phone: travelLeads.phone,
            email: travelLeads.email,
            statusId: travelLeads.statusId,
            statusName: travelStatuses.status
        })
        .from(travelLeads)
        .leftJoin(
            travelStatuses,
            eq(travelLeads.statusId, travelStatuses.id)
        )
        .where(and(eq(travelLeads.id, leadId), eq(travelLeads.organizationId, organizationId)))
        .limit(1)

    if (!row) return null

    const notes = await db
        .select({
            note: travelLeadNotes.note,
            createdAt: travelLeadNotes.createdAt
        })
        .from(travelLeadNotes)
        .where(eq(travelLeadNotes.leadId, leadId))
        .orderBy(sql`${travelLeadNotes.createdAt} DESC`)

    return {
        publicId: leadPublicId(organizationId, source, row.id),
        name: cleanName(row.name),
        phone: row.phone.trim(),
        email: row.email.trim(),
        notes: formatNotes(notes),
        status: row.statusName?.trim() || '',
        statusId: row.statusId ?? null
    }
}

/* -------------------------------------------------------------------------- */
/*                              Connection test                               */
/* -------------------------------------------------------------------------- */

export interface TestConnectionInput {
    organizationId: string
    integrationId?: number
    webAppUrl?: string
    secret?: string
}

export async function testGoogleSheetsConnection(
    input: TestConnectionInput
): Promise<{ sheet: string; rows: number }> {
    const row = input.integrationId
        ? await getIntegrationRow(input.organizationId, input.integrationId)
        : null

    if (input.integrationId && !row) {
        throw new SheetsError('La integración no existe en esta organización.')
    }

    const url = input.webAppUrl?.trim()
        ? normalizeAppsScriptUrl(input.webAppUrl)
        : row?.webAppUrl
    const secret = input.secret?.trim()
        ? input.secret.trim()
        : row?.secretEncrypted
          ? decryptSecret(row.secretEncrypted)
          : ''

    if (!url) {
        throw new SheetsError('Configurá la URL de Google Apps Script.')
    }
    if (!secret) {
        throw new SheetsError('Configurá la clave secreta.')
    }

    try {
        const result = await postToAppsScript(url, {
            secret,
            organizationId: input.organizationId,
            protocol: 2,
            action: 'ping'
        })

        if (row) {
            await db
                .update(googleSheetsIntegrations)
                .set({ lastTestedAt: new Date(), lastError: null })
                .where(eq(googleSheetsIntegrations.id, row.id))
        }

        return {
            sheet: result.sheet ?? 'Leads',
            rows: result.rows ?? 0
        }
    } catch (error) {
        const message = safeErrorMessage(error)
        if (row) {
            await db
                .update(googleSheetsIntegrations)
                .set({ lastTestedAt: new Date(), lastError: message })
                .where(eq(googleSheetsIntegrations.id, row.id))
        }
        throw new SheetsError(message)
    }
}

/* -------------------------------------------------------------------------- */
/*                                Retry/status                                */
/* -------------------------------------------------------------------------- */

export function safeErrorMessage(error: unknown): string {
    return error instanceof Error && error.name === 'SheetsError'
        ? error.message : 'No se pudo completar la sincronización. Revisá la configuración y reintentá.'
}

export async function retryFailedGoogleSheetsSyncs(
    organizationId: string,
    integrationId?: number
): Promise<number> {
    const conditions = [
        eq(googleSheetsSyncJobs.organizationId, organizationId),
        eq(googleSheetsSyncJobs.protocol, 2),
        inArray(googleSheetsSyncJobs.status, ['failed', 'dead'])
    ]
    if (integrationId) {
        conditions.push(eq(googleSheetsSyncJobs.integrationId, integrationId))
    }

    const rows = await db
        .update(googleSheetsSyncJobs)
        .set({
            status: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: null,
            lockedAt: null,
            updatedAt: new Date()
        })
        .where(and(...conditions))
        .returning({ id: googleSheetsSyncJobs.id })

    return rows.length
}

/* -------------------------------------------------------------------------- */
/*                               Bulk enqueue                                 */
/* -------------------------------------------------------------------------- */

export async function syncIntegrationLeads(
    organizationId: string,
    integrationId: number
) {
    const row = await getIntegrationRow(organizationId, integrationId)
    if (!row?.enabled || !row.webAppUrl || !row.secretEncrypted) {
        throw new SheetsError('Activá y configurá la integración antes de sincronizar.')
    }

    // Restart the enabled sources so the next scan reconciles the whole sheet:
    // leads that no longer match the selected statuses are removed. A disabled
    // source keeps any pending cursor so a previously queued cleanup still runs.
    await db
        .update(googleSheetsIntegrations)
        .set({
            ...(row.syncCustomers ? { customerCursor: 0 } : {}),
            ...(row.syncTravel ? { travelCursor: 0 } : {}),
            updatedAt: new Date()
        })
        .where(eq(googleSheetsIntegrations.id, integrationId))

    return {
        queued: 0,
        scanning: true
    }
}

async function enqueueScanPage(integration: IntegrationRow) {
    if (!integration.enabled) return
    if (
        integration.customerCursor === null &&
        integration.travelCursor === null
    ) {
        return
    }

    await db.transaction(async (tx) => {
        const [settings] = await tx
            .select()
            .from(googleSheetsIntegrations)
            .where(eq(googleSheetsIntegrations.id, integration.id))
        if (!settings?.enabled) return

        for (const source of LEAD_SOURCES) {
            const cursorKey =
                source === 'customer' ? 'customerCursor' : 'travelCursor'
            const cursor = settings[cursorKey]
            if (cursor === null) continue

            const table = source === 'customer' ? customers : travelLeads
            const rows = await tx
                .select({ id: table.id })
                .from(table)
                .where(
                    and(
                        eq(table.organizationId, settings.organizationId),
                        sql`${table.id} > ${cursor}`
                    )
                )
                .orderBy(table.id)
                .limit(100)

            if (rows.length) {
                await tx.insert(googleSheetsSyncJobs).values(
                    rows.map((row) => ({
                        organizationId: settings.organizationId,
                        integrationId: settings.id,
                        leadSource: source,
                        leadId: row.id,
                        operation: 'upsert' as const
                    }))
                )
            }

            await tx
                .update(googleSheetsIntegrations)
                .set({
                    [cursorKey]:
                        rows.length === 100
                            ? rows[rows.length - 1].id
                            : null
                })
                .where(eq(googleSheetsIntegrations.id, settings.id))
        }
    })
}

/* -------------------------------------------------------------------------- */
/*                              Outbox worker                                 */
/* -------------------------------------------------------------------------- */

function rowNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number(value ?? 0)
}

async function claimJobs(integrationId: number, limit: number): Promise<ClaimedJob[]> {
    const leaseToken = randomUUID()
    // Keep the newest durable revision, including completed jobs, for ordering.
    await db.$client.execute({ sql: `UPDATE google_sheets_sync_jobs AS old
        SET status = 'done', last_error = NULL
        WHERE integration_id = ? AND protocol = 2 AND status IN ('pending','failed','dead')
        AND EXISTS (SELECT 1 FROM google_sheets_sync_jobs AS newer
            WHERE newer.integration_id = old.integration_id AND newer.lead_source = old.lead_source
              AND newer.lead_id = old.lead_id AND newer.protocol = 2 AND newer.id > old.id)`, args: [integrationId] })
    const result = await db.$client.execute({
        sql: `UPDATE google_sheets_sync_jobs SET status = 'processing', locked_at = unixepoch(),
            lease_token = ?, attempts = attempts + 1, updated_at = unixepoch()
            WHERE id IN (SELECT id FROM google_sheets_sync_jobs
                WHERE integration_id = ? AND protocol = 2
                AND ((status IN ('pending','failed') AND next_attempt_at <= unixepoch())
                  OR (status = 'processing' AND locked_at <= unixepoch() - 120))
                ORDER BY id DESC LIMIT ?)
            RETURNING id, organization_id, integration_id, lead_source, lead_id, operation, attempts, version`,
        args: [leaseToken, integrationId, limit]
    })
    return result.rows.map(row => ({
        id: rowNumber(row.id), organizationId: String(row.organization_id),
        integrationId: rowNumber(row.integration_id),
        leadSource: String(row.lead_source) as LeadSource, leadId: rowNumber(row.lead_id),
        operation: String(row.operation) as SyncOperation, attempts: rowNumber(row.attempts),
        version: rowNumber(row.version), leaseToken
    }))
}

function ownedLease(job: ClaimedJob) {
    return and(eq(googleSheetsSyncJobs.id, job.id), eq(googleSheetsSyncJobs.leaseToken, job.leaseToken), eq(googleSheetsSyncJobs.status, 'processing'))
}

function backoffDate(attempts: number): Date {
    const seconds = Math.min(6 * 60 * 60, 60 * 2 ** Math.max(0, attempts - 1))
    return new Date(Date.now() + seconds * 1000)
}

async function markJobFailed(
    job: ClaimedJob,
    error: string,
    maxAttempts: number
) {
    const dead = job.attempts >= maxAttempts

    const changed = await db
        .update(googleSheetsSyncJobs)
        .set({
            status: dead ? 'dead' : 'failed',
            lastError: error,
            nextAttemptAt: backoffDate(job.attempts),
            lockedAt: null,
            updatedAt: new Date()
        })
        .where(ownedLease(job))
        .returning({ id: googleSheetsSyncJobs.id })
    if (!changed.length) return

    await db
        .update(googleSheetsIntegrations)
        .set({ lastError: error, updatedAt: new Date() })
        .where(eq(googleSheetsIntegrations.id, job.integrationId))
}

function sourceEnabled(integration: IntegrationRow, source: LeadSource) {
    return source === 'customer'
        ? Boolean(integration.syncCustomers)
        : Boolean(integration.syncTravel)
}

function sourceStatusIds(integration: IntegrationRow, source: LeadSource) {
    return parseStatusIds(
        source === 'customer'
            ? integration.customerStatusIds
            : integration.travelStatusIds
    )
}

function matchesFilters(
    integration: IntegrationRow,
    source: LeadSource,
    snapshot: LeadSnapshot | null
) {
    if (!snapshot) return false
    if (!sourceEnabled(integration, source)) return false
    const statusIds = sourceStatusIds(integration, source)
    if (statusIds.length === 0) return true
    return snapshot.statusId !== null && statusIds.includes(snapshot.statusId)
}

async function processJob(
    job: ClaimedJob,
    integration: IntegrationRow,
    secret: string,
    deadline: number
): Promise<boolean> {
    try {
        const snapshot = await loadLeadSnapshot(job.organizationId, job.leadSource, job.leadId)
        const shouldDelete =
            job.operation === 'delete' ||
            !matchesFilters(integration, job.leadSource, snapshot)

        if (shouldDelete) {
            await postToAppsScript(integration.webAppUrl, {
                secret,
                organizationId: job.organizationId,
                protocol: 2,
                action: 'delete',
                version: job.version,
                lead: { id: leadPublicId(job.organizationId, job.leadSource, job.leadId) }
            }, deadline)
        } else if (snapshot) {
            await postToAppsScript(integration.webAppUrl, {
                secret,
                organizationId: job.organizationId,
                protocol: 2,
                action: 'upsert',
                version: job.version,
                lead: {
                    id: snapshot.publicId,
                    name: snapshot.name,
                    phone: snapshot.phone,
                    email: snapshot.email,
                    notes: snapshot.notes,
                    status: snapshot.status
                }
            }, deadline)

        }

        const changed = await db
            .update(googleSheetsSyncJobs)
            .set({ status: 'done', lastError: null, lockedAt: null, leaseToken: null, updatedAt: new Date() })
            .where(ownedLease(job))
            .returning({ id: googleSheetsSyncJobs.id })
        if (!changed.length) return false

        await db
            .update(googleSheetsIntegrations)
            .set({ lastSuccessAt: new Date(), lastError: null })
            .where(eq(googleSheetsIntegrations.id, job.integrationId))

        return true
    } catch (error) {
        const message = safeErrorMessage(error)
        await markJobFailed(job, message, integration.maxAttempts)
        return false
    }
}

async function getEnabledIntegrations(
    organizationId?: string,
    integrationId?: number
): Promise<IntegrationRow[]> {
    if (integrationId) {
        const row = await getIntegrationRowById(integrationId)
        if (!row) return []
        if (organizationId && row.organizationId !== organizationId) return []
        return [row]
    }

    const conditions = [eq(googleSheetsIntegrations.enabled, true)]
    if (organizationId) {
        conditions.push(
            eq(googleSheetsIntegrations.organizationId, organizationId)
        )
    }

    return db
        .select()
        .from(googleSheetsIntegrations)
        .where(and(...conditions))
        .orderBy(googleSheetsIntegrations.updatedAt)
}

export interface ProcessSyncOptions {
    organizationId?: string
    integrationId?: number
    limit?: number
    timeBudgetMs?: number
}

export interface ProcessSyncResult {
    processed: number
    succeeded: number
    failed: number
}

export async function processPendingGoogleSheetsSyncs(
    options: ProcessSyncOptions = {}
): Promise<ProcessSyncResult> {
    const integrations = await getEnabledIntegrations(
        options.organizationId,
        options.integrationId
    )

    const limit = Math.max(1, options.limit ?? 25)
    const timeBudgetMs = Math.max(1000, options.timeBudgetMs ?? 20_000)
    const startedAt = Date.now()
    const deadline = startedAt + timeBudgetMs

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const integration of integrations) {
        let integrationProcessed = 0
        if (Date.now() + 2000 >= deadline) break
        if (!integration.enabled) continue

        await db
            .update(googleSheetsIntegrations)
            .set({ updatedAt: new Date() })
            .where(eq(googleSheetsIntegrations.id, integration.id))

        try {
            await enqueueScanPage(integration)
        } catch (error) {
            await db
                .update(googleSheetsIntegrations)
                .set({
                    lastError: safeErrorMessage(error),
                    updatedAt: new Date()
                })
                .where(eq(googleSheetsIntegrations.id, integration.id))
            continue
        }

        if (!integration.webAppUrl || !integration.secretEncrypted) {
            continue
        }

        let secret: string
        try {
            secret = decryptSecret(integration.secretEncrypted)
        } catch (error) {
            const message = safeErrorMessage(error)
            await db
                .update(googleSheetsIntegrations)
                .set({ lastError: message, updatedAt: new Date() })
                .where(eq(googleSheetsIntegrations.id, integration.id))
            continue
        }

        while (
            integrationProcessed < limit &&
            Date.now() + 2000 < deadline
        ) {
            const batch = await claimJobs(integration.id, 1)

            if (batch.length === 0) break

            for (const job of batch) {
                const ok = await processJob(
                    job,
                    integration,
                    secret,
                    deadline - 1000
                )
                processed++
                integrationProcessed++
                if (ok) succeeded++
                else failed++
            }
        }
    }

    return { processed, succeeded, failed }
}

/**
 * Schedules a small worker run after the HTTP response has been sent. Most
 * writes are reflected in Google Sheets within seconds without blocking the
 * request; the cron/manual retry handles whatever is left.
 */
export function scheduleGoogleSheetsProcessing(
    organizationId: string,
    options: { limit?: number; timeBudgetMs?: number } = {}
) {
    after(() =>
        processPendingGoogleSheetsSyncs({
            organizationId,
            limit: options.limit ?? 8,
            timeBudgetMs: options.timeBudgetMs ?? 8_000
        }).catch((error) => {
            console.error(
                '[google-sheets] Error procesando la cola:',
                safeErrorMessage(error)
            )
        })
    )
}

/** Used after global changes (for example renaming a shared status). */
export function scheduleAllEnabledGoogleSheetsProcessing(
    options: { limit?: number; timeBudgetMs?: number } = {}
) {
    after(async () => {
        try {
            await processPendingGoogleSheetsSyncs({
                limit: options.limit ?? 8,
                timeBudgetMs: options.timeBudgetMs ?? 8_000
            })
        } catch (error) {
            console.error(
                '[google-sheets] Error procesando la cola global:',
                safeErrorMessage(error)
            )
        }
    })
}
