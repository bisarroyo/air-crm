import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email/campaign'

/** Envía una copia de prueba a unTester antes de salir a todos los clientes. */
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

    const result = await sendTestEmail({
        to: typeof body.to === 'string' ? body.to.trim() : '',
        subject: typeof body.subject === 'string' ? body.subject : '',
        bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : '',
        bcc: typeof body.bcc === 'string' ? body.bcc : '',
        customerId: Number.isInteger(body.customerId as number)
            ? (body.customerId as number)
            : null
    })

    if ('error' in result) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        )
    }

    return NextResponse.json({ success: true })
}