import { NextResponse } from 'next/server'

import { processPendingGoogleSheetsSyncs } from '@/lib/integrations/google-sheets'

export const maxDuration = 60

function isAuthorized(request: Request): boolean {
    const expected = process.env.CRON_SECRET
    if (!expected) return false

    const authorization = request.headers.get('authorization')
    return authorization === `Bearer ${expected}`
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await processPendingGoogleSheetsSyncs({
        limit: 200,
        timeBudgetMs: 50_000
    })

    return NextResponse.json({ ok: true, ...result })
}

export const POST = GET
