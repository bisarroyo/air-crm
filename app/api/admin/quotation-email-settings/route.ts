import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotationEmailSettings } from '@/db/schema'
import { getQuotationEmailSettings } from '@/lib/cotizaciones/email-settings'
import {
    validateEmailSettings,
    type QuotationEmailSettings
} from '@/lib/cotizaciones/email'

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    return NextResponse.json(await getQuotationEmailSettings())
}
export async function PUT(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'admin')
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const body: unknown = await request.json().catch(() => null)
    const error = validateEmailSettings(body)
    if (error) return NextResponse.json({ error }, { status: 400 })
    const value = body as QuotationEmailSettings
    const values = {
        copyCompany: value.copyCompany,
        defaultTemplateId: value.defaultTemplateId,
        templates: JSON.stringify(value.templates)
    }
    await db
        .insert(quotationEmailSettings)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({ target: quotationEmailSettings.id, set: values })
    return NextResponse.json(value)
}
