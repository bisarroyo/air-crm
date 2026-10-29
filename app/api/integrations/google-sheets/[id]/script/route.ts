import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { organizationAccess } from '@/lib/organization-access'
import { auth } from '@/lib/auth'
import {
    APPS_SCRIPT_STEPS,
    appsScriptFilename,
    appsScriptProperties,
    buildAppsScript
} from '@/lib/integrations/google-sheets-apps-script'
import {
    getGoogleSheetsIntegration,
    getOrganizationId,
    safeErrorMessage
} from '@/lib/integrations/google-sheets'
import { SheetsError } from '@/lib/integrations/google-sheets-transport'

export const maxDuration = 30

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        const { id } = await params
        const integrationId = Number(id)
        if (!Number.isSafeInteger(integrationId) || integrationId <= 0) {
            throw new SheetsError('El identificador de la integración no es válido.')
        }

        const organizationId = await getOrganizationId(session)
        const integration = await getGoogleSheetsIntegration(
            organizationId,
            integrationId
        )
        if (!integration) {
            throw new SheetsError(
                'La integración no existe en esta organización.'
            )
        }

        const config = {
            integrationName: integration.name,
            organizationId: integration.organizationId,
            fields: integration.fields
        }

        return NextResponse.json({
            integrationId: integration.id,
            code: buildAppsScript(config),
            filename: appsScriptFilename(config),
            properties: appsScriptProperties(config),
            steps: APPS_SCRIPT_STEPS,
            fields: integration.fields
        })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
