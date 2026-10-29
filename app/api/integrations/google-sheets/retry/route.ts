import { organizationAccess } from '@/lib/organization-access'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { SheetsError } from '@/lib/integrations/google-sheets-transport'
import {
    getOrganizationId,
    retryFailedGoogleSheetsSyncs,
    safeErrorMessage,
    scheduleGoogleSheetsProcessing
} from '@/lib/integrations/google-sheets'

export const maxDuration = 30

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const organizationId = await getOrganizationId(session)

    try {
        const body = await request.json().catch(() => ({}))
        const integrationId = Number(body?.integrationId)
        const scopedId =
            Number.isSafeInteger(integrationId) && integrationId > 0
                ? integrationId
                : undefined
        if (!scopedId) {
            throw new SheetsError('Falta el identificador de la integración.')
        }

        const retried = await retryFailedGoogleSheetsSyncs(
            organizationId,
            scopedId
        )
        scheduleGoogleSheetsProcessing(organizationId, {
            limit: 50,
            timeBudgetMs: 20_000
        })

        return NextResponse.json({ ok: true, retried })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
