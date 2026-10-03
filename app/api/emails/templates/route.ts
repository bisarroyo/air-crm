import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { EMAIL_PRESETS } from '@/lib/email/presets'
import {
    unknownVariables,
    validateTemplateInput
} from '@/lib/email/template'

/**
 * Lista las plantillas guardadas, agrupables por categoría. Si la tabla está
 * vacía se ofrecen las de ejemplo desde la pestaña de plantillas (import), no
 * aquí: el listado es de solo lectura.
 */
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
        .select()
        .from(emailTemplates)
        .orderBy(asc(emailTemplates.category), asc(emailTemplates.name))

    return NextResponse.json({ data: rows })
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const [created] = await db
        .insert(emailTemplates)
        .values({
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
            createdBy: session.user.id
        })
        .returning()

    return NextResponse.json({ data: created }, { status: 201 })
}

/**
 * Importa las plantillas de ejemplo del código. Se salta las que ya existen
 * con el mismo nombre para poder volver a pulsarlo sin duplicar.
 */
export async function PUT() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await db
        .select({ name: emailTemplates.name })
        .from(emailTemplates)

    const existingNames = new Set(existing.map((row) => row.name))
    const pending = EMAIL_PRESETS.filter(
        (preset) => !existingNames.has(preset.name)
    )

    if (pending.length === 0) {
        return NextResponse.json({ imported: 0, total: existingNames.size })
    }

    await db.insert(emailTemplates).values(
        pending.map((preset) => ({
            name: preset.name,
            description: preset.description,
            category: preset.category,
            subject: preset.subject,
            bodyHtml: preset.bodyHtml,
            createdBy: session.user.id
        }))
    )

    return NextResponse.json({
        imported: pending.length,
        total: existingNames.size + pending.length
    })
}