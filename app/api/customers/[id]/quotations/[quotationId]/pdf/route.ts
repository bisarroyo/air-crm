import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import {
    canManageQuotation,
    parseQuotationData
} from '@/lib/cotizaciones/quotation'
import { buildQuotationPdf } from '@/lib/cotizaciones/pdf'
import {
    quotationPdfFilename,
    type QuotationData
} from '@/lib/cotizaciones/shared'

type RouteParams = { params: Promise<{ id: string; quotationId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
    const { id, quotationId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [row] = await db
        .select()
        .from(quotations)
        .where(
            and(
                eq(quotations.id, Number(quotationId)),
                eq(quotations.customerId, Number(id))
            )
        )
        .limit(1)

    if (!row) {
        return NextResponse.json(
            { error: 'Quotation not found' },
            { status: 404 }
        )
    }

    const sessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    if (!canManageQuotation(row, sessionUser)) {
        return NextResponse.json(
            { error: 'No tienes permiso para esta acción' },
            { status: 403 }
        )
    }

    const data = parseQuotationData(row)
    if (!data) {
        return NextResponse.json(
            { error: 'La cotización no tiene datos para generar el PDF' },
            { status: 400 }
        )
    }

    try {
        const buffer = await buildQuotationPdf(
            data as QuotationData,
            row.number
        )
        const filename = quotationPdfFilename(row.number, data.client.name)

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store'
            }
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'PDF error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}