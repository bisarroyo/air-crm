import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import {
    unknownVariables,
    validateTemplateInput
} from '@/lib/email/template'

async function getTemplate(id: number) {
    const rows = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, id))
        .limit(1)
    return rows[0] ?? null
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const templateId = Number(id)
    if (!Number.isInteger(templateId)) {
        return NextResponse.json(
            { error: 'Plantilla inválida' },
            { status: 400 }
        )
    }

    const existing = await getTemplate(templateId)
    if (!existing) {
        return NextResponse.json(
            { error: 'Plantilla no encontrada' },
            { status: 404 }
        )
    }

    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const input = payload as Record<string, unknown>
    const invalid = validateTemplateInput(input)
    if (invalid) {
        return NextResponse.json({ error: invalid }, { status: 400 })
    }

    const unknown = [
        ...unknownVariables(String(input.subject ?? '')),
        ...unknownVariables(String(input.bodyHtml ?? ''))
    ]
    if (unknown.length > 0) {
        return NextResponse.json(
            {
                error: `Variables desconocidas: ${unknown.join(', ')}. Revisa la lista de variables disponibles.`
            },
            { status: 400 }
        )
    }

    const [updated] = await db
        .update(emailTemplates)
        .set({
            name: String(input.name).trim(),
            description: input.description
                ? String(input.description).trim()
                : null,
            category: String(input.category ?? 'Seguimiento') as
                | 'Seguimiento'
                | 'Promoción'
                | 'Cotización'
                | 'Relación',
            subject: String(input.subject).trim(),
            bodyHtml: String(input.bodyHtml).trim(),
            updatedAt: sql`(unixepoch())`
        })
        .where(eq(emailTemplates.id, templateId))
        .returning()

    return NextResponse.json({ data: updated })
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const templateId = Number(id)
    if (!Number.isInteger(templateId)) {
        return NextResponse.json(
            { error: 'Plantilla inválida' },
            { status: 400 }
        )
    }

    const existing = await getTemplate(templateId)
    if (!existing) {
        return NextResponse.json(
            { error: 'Plantilla no encontrada' },
            { status: 404 }
        )
    }

    await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId))

    return NextResponse.json({ status: 200 })
}