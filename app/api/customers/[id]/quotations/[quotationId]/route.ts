import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import {
    canManageQuotation,
    parseQuotationData,
    toSummary,
    updateQuotation,
    type SaveQuotationInput,
    type SessionUser
} from '@/lib/cotizaciones/quotation'
import { QUOTATION_STATUSES, type QuotationStatus } from '@/lib/cotizaciones/shared'

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

    const sessionUser: SessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    return NextResponse.json({
        ...toSummary(row, sessionUser),
        data: parseQuotationData(row)
    })
}

export async function PUT(request: Request, { params }: RouteParams) {
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

    const sessionUser: SessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    if (!canManageQuotation(row, sessionUser)) {
        return NextResponse.json(
            { error: 'No tienes permiso para editar esta cotización' },
            { status: 403 }
        )
    }

    const editableStates: QuotationStatus[] = ['draft', 'sent']
    if (session.user.role !== 'admin' && !editableStates.includes(row.status)) {
        return NextResponse.json(
            {
                error: 'Solo se pueden editar cotizaciones en borrador o enviadas. Anula la cotización y crea una nueva.'
            },
            { status: 409 }
        )
    }

    const body = (await request.json()) as SaveQuotationInput
    const result = await updateQuotation(row.id, body, sessionUser)
    if (result.error || !result.quotation) {
        return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
        ...toSummary(result.quotation, sessionUser),
        data: parseQuotationData(result.quotation)
    })
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const sessionUser: SessionUser = {
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

    const body = (await request.json()) as { status?: string }
    if (!body.status || !QUOTATION_STATUSES.includes(body.status as QuotationStatus)) {
        return NextResponse.json(
            { error: 'Estado no válido' },
            { status: 400 }
        )
    }

    const [updated] = await db
        .update(quotations)
        .set({ status: body.status as QuotationStatus })
        .where(eq(quotations.id, row.id))
        .returning()

    return NextResponse.json(toSummary(updated, sessionUser))
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

    const sessionUser: SessionUser = {
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

    if (row.status !== 'draft' && session.user.role !== 'admin') {
        return NextResponse.json(
            {
                error: 'Solo se pueden eliminar cotizaciones en borrador. Anula la cotización en su lugar.'
            },
            { status: 409 }
        )
    }

    await db.delete(quotations).where(eq(quotations.id, row.id))
    return NextResponse.json({ ok: true })
}