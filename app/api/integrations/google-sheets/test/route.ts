import { organizationAccess } from '@/lib/organization-access'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import {
    getOrganizationId,
    safeErrorMessage,
    testGoogleSheetsConnection
} from '@/lib/integrations/google-sheets'

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || !(await organizationAccess(session, true))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let body: Record<string, unknown> = {}
    try {
        body = await request.json()
    } catch {
        // The test can also use the stored configuration without a body.
    }

    try {
        const rawId = Number(body.integrationId)
        const result = await testGoogleSheetsConnection({
            organizationId: await getOrganizationId(session),
            integrationId:
                Number.isSafeInteger(rawId) && rawId > 0 ? rawId : undefined,
            webAppUrl:
                typeof body.webAppUrl === 'string'
                    ? body.webAppUrl
                    : undefined,
            secret:
                typeof body.secret === 'string' ? body.secret : undefined
        })

        return NextResponse.json({
            ok: true,
            message: 'Conexión verificada correctamente.',
            sheet: result.sheet,
            rows: result.rows
        })
    } catch (error) {
        return NextResponse.json(
            { error: safeErrorMessage(error) },
            { status: 400 }
        )
    }
}
