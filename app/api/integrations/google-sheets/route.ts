import { organizationAccess } from '@/lib/organization-access'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { SheetsError } from '@/lib/integrations/google-sheets-transport'
import {
    createGoogleSheetsIntegration,
    deleteGoogleSheetsIntegration,
    getGoogleSheetsStatusOptions,
    getOrganizationId,
    isSecretEncryptionConfigured,
    listGoogleSheetsIntegrations,
    safeErrorMessage,
    scheduleGoogleSheetsProcessing,
    updateGoogleSheetsIntegration,
    type GoogleSheetsIntegrationSnapshot,
    type IntegrationInput
} from '@/lib/integrations/google-sheets'

export const maxDuration = 30

async function getAdminSession() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) return null
    return session
}

function needsProcessing(integration: GoogleSheetsIntegrationSnapshot) {
    return (
        integration.status.pending > 0 ||
        integration.status.processing > 0 ||
        integration.status.failed > 0 ||
        integration.status.scanning
    )
}

async function listPayload(organizationId: string) {
    const [integrations, statusOptions] = await Promise.all([
        listGoogleSheetsIntegrations(organizationId),
        getGoogleSheetsStatusOptions()
    ])

    if (integrations.some(needsProcessing)) {
        scheduleGoogleSheetsProcessing(organizationId, {
            limit: 20,
            timeBudgetMs: 20_000
        })
    }

    return {
        integrations,
        customerStatuses: statusOptions.customers,
        travelStatuses: statusOptions.travel,
        encryptionConfigured: isSecretEncryptionConfigured()
    }
}

function numberArray(value: unknown): number[] | undefined {
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

function stringArray(value: unknown): string[] | undefined {
    if (value === undefined) return undefined
    if (!Array.isArray(value)) {
        throw new SheetsError('La selección de campos no es válida.')
    }
    return value.filter((item): item is string => typeof item === 'string')
}

function integrationIdFrom(value: unknown): number {
    const id = Number(value)
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new SheetsError('Falta el identificador de la integración.')
    }
    return id
}

function parseInput(body: Record<string, unknown>): IntegrationInput {
    return {
        name: typeof body.name === 'string' ? body.name : undefined,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        webAppUrl:
            typeof body.webAppUrl === 'string' ? body.webAppUrl : undefined,
        secret: typeof body.secret === 'string' ? body.secret : undefined,
        clearSecret: body.clearSecret === true,
        maxAttempts:
            typeof body.maxAttempts === 'number'
                ? body.maxAttempts
                : undefined,
        syncCustomers:
            typeof body.syncCustomers === 'boolean'
                ? body.syncCustomers
                : undefined,
        syncTravel:
            typeof body.syncTravel === 'boolean'
                ? body.syncTravel
                : undefined,
        customerStatusIds: numberArray(body.customerStatusIds),
        travelStatusIds: numberArray(body.travelStatusIds),
        fields: stringArray(body.fields)
    }
}

export async function GET() {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        const organizationId = await getOrganizationId(session)
        return NextResponse.json(await listPayload(organizationId))
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}

export async function POST(request: Request) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    try {
        const organizationId = await getOrganizationId(session)
        const integration = await createGoogleSheetsIntegration(
            organizationId,
            parseInput(body)
        )
        scheduleGoogleSheetsProcessing(organizationId)
        return NextResponse.json({
            ...(await listPayload(organizationId)),
            createdIntegrationId: integration.id
        })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}

export async function PUT(request: Request) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    try {
        const organizationId = await getOrganizationId(session)
        const integrationId = integrationIdFrom(body.id)
        await updateGoogleSheetsIntegration(
            organizationId,
            integrationId,
            parseInput(body)
        )
        scheduleGoogleSheetsProcessing(organizationId)
        return NextResponse.json(await listPayload(organizationId))
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}

export async function DELETE(request: Request) {
    const session = await getAdminSession()
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        const organizationId = await getOrganizationId(session)
        const url = new URL(request.url)
        const body = await request.json().catch(() => ({}))
        const integrationId = integrationIdFrom(
            body?.integrationId ?? url.searchParams.get('integrationId')
        )
        await deleteGoogleSheetsIntegration(organizationId, integrationId)
        return NextResponse.json(await listPayload(organizationId))
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
