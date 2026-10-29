import { organizationAccess } from '@/lib/organization-access'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import {
    getOrganizationId,
    listGoogleSheetsIntegrations,
    safeErrorMessage,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export const maxDuration = 30

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        const organizationId = await getOrganizationId(session)
        const integrations = await listGoogleSheetsIntegrations(organizationId)

        if (
            integrations.some(
                (integration) =>
                    integration.status.pending > 0 ||
                    integration.status.processing > 0 ||
                    integration.status.failed > 0 ||
                    integration.status.scanning
            )
        ) {
            scheduleGoogleSheetsProcessing(organizationId, {
                limit: 20,
                timeBudgetMs: 20_000
            })
        }

        return NextResponse.json({ integrations })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
