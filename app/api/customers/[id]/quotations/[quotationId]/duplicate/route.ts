import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import {
    canManageQuotation,
    duplicateQuotation
} from '@/lib/cotizaciones/quotation'

type RouteParams = { params: Promise<{ id: string; quotationId: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
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

    const result = await duplicateQuotation(row)
    if (!result.quotation) {
        return NextResponse.json(
            { error: 'No se pudo duplicar la cotización' },
            { status: 500 }
        )
    }

    return NextResponse.json({ id: result.quotation.id, number: result.quotation.number }, { status: 201 })
}