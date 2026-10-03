import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { loadRecipients } from '@/lib/email/recipients'
import {
    htmlToText,
    renderTemplate,
    renderTemplateHtml,
    unknownVariables,
    wrapEmailHtml
} from '@/lib/email/template'
import { buildTemplateVars, sampleTemplateVars } from '@/lib/email/variables'

/**
 * Resuelve el asunto y el cuerpo con los datos de un cliente concreto para
 * mostrar exactamente lo que se va a enviar. Usa las mismas funciones que el
 * envío real, así que lo que se ve en pantalla es lo que llega al buzón.
 */
export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const subject = typeof body.subject === 'string' ? body.subject : ''
    const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml : ''
    const customerId = Number.isInteger(body.customerId as number)
        ? (body.customerId as number)
        : null

    let vars = sampleTemplateVars()
    if (customerId != null) {
        const loaded = await loadRecipients([customerId], null)
        if (loaded[0]) vars = buildTemplateVars(loaded[0].context)
    }

    return NextResponse.json({
        subject: renderTemplate(subject, vars),
        html: wrapEmailHtml(renderTemplateHtml(bodyHtml, vars)),
        text: htmlToText(renderTemplate(bodyHtml, vars)),
        unknown: [
            ...unknownVariables(subject),
            ...unknownVariables(bodyHtml)
        ]
    })
}