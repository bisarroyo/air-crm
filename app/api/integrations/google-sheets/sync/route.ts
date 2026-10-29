import { organizationAccess } from '@/lib/organization-access'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { SheetsError } from '@/lib/integrations/google-sheets-transport'
import {
    getOrganizationId,
    safeErrorMessage,
    scheduleGoogleSheetsProcessing,
    syncIntegrationLeads
} from '@/lib/integrations/google-sheets'

export const maxDuration = 60

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const organizationId = await getOrganizationId(session)

    try {
        const body = await request.json().catch(() => ({}))
        const integrationId = Number(body?.integrationId)
        if (!Number.isSafeInteger(integrationId) || integrationId <= 0) {
            throw new SheetsError('Falta el identificador de la integración.')
        }

        const result = await syncIntegrationLeads(
            organizationId,
            integrationId
        )

        // Process a first batch after the response is sent. The rest is drained
        // by the cron job (or by the next write) without blocking the UI.
        scheduleGoogleSheetsProcessing(organizationId, {
            limit: 100,
            timeBudgetMs: 45_000
        })

        return NextResponse.json({
            ok: true,
            queued: result.queued,
            message: 'Sincronización iniciada; se preparará y procesará por lotes.'
        })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
