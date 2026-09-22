import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotationSettings } from '@/db/schema'
import { getCompanySettings, companyToSnapshot } from '@/lib/cotizaciones/quotation'
import { isCurrency } from '@/lib/cotizaciones/shared'

const STRING_FIELDS = [
    'companyName',
    'logo',
    'phone',
    'whatsapp',
    'email',
    'website',
    'facebook',
    'instagram',
    'address',
    'terms',
    'advisorName',
    'advisorEmail'
] as const

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const row = await getCompanySettings()
    return NextResponse.json(companyToSnapshot(row))
}

export async function PUT(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const updateData: Record<string, string> = {}

    for (const key of STRING_FIELDS) {
        if (body[key] !== undefined) {
            updateData[key] = typeof body[key] === 'string' ? body[key] : String(body[key] ?? '')
        }
    }

    if (body.currency !== undefined) {
        if (!isCurrency(String(body.currency))) {
            return NextResponse.json(
                { error: 'Moneda no válida' },
                { status: 400 }
            )
        }
        updateData.currency = String(body.currency)
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { error: 'No fields to update' },
            { status: 400 }
        )
    }

    try {
        const [updated] = await db
            .update(quotationSettings)
            .set(updateData)
            .where(eq(quotationSettings.id, 1))
            .returning()

        return NextResponse.json(companyToSnapshot(updated))
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}