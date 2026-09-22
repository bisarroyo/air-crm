import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { quotations, customers } from '@/db/schema'
import {
    createQuotation,
    toSummary,
    type SaveQuotationInput,
    type SessionUser
} from '@/lib/cotizaciones/quotation'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = Number(id)
    const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1)

    if (!customer) {
        return NextResponse.json(
            { error: 'Customer not found' },
            { status: 404 }
        )
    }

    const rows = await db
        .select()
        .from(quotations)
        .where(eq(quotations.customerId, customerId))
        .orderBy(desc(quotations.createdAt))

    const sessionUser: SessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    return NextResponse.json(rows.map((row) => toSummary(row, sessionUser)))
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = Number(id)
    const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1)

    if (!customer) {
        return NextResponse.json(
            { error: 'Customer not found' },
            { status: 404 }
        )
    }

    const body = (await request.json()) as SaveQuotationInput
    const sessionUser: SessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }

    const result = await createQuotation(customerId, body, sessionUser)
    if (result.error || !result.quotation) {
        return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
        {
            ...toSummary(result.quotation, sessionUser),
            data: result.quotation.data
        },
        { status: 201 }
    )
}