import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { createCampaign, listCampaigns } from '@/lib/email/campaign'
import { isSmtpConfigured, smtpSettings } from '@/lib/email/smtp'

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await listCampaigns({
        id: session.user.id,
        role: session.user.role
    })

    return NextResponse.json({
        data: rows,
        smtpConfigured: isSmtpConfigured(),
        sender: isSmtpConfigured() ? smtpSettings().fromAddress : null
    })
}

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

    const result = await createCampaign(
        {
            name: typeof body.name === 'string' ? body.name : '',
            subject: typeof body.subject === 'string' ? body.subject : '',
            bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : '',
            mode: typeof body.mode === 'string' ? body.mode : 'visual',
            bcc: typeof body.bcc === 'string' ? body.bcc : '',
            customerIds: Array.isArray(body.customerIds)
                ? (body.customerIds as unknown[]).filter((id): id is number =>
                      Number.isInteger(id)
                  )
                : []
        },
        { id: session.user.id, role: session.user.role }
    )

    if ('error' in result) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        )
    }

    return NextResponse.json(result, { status: 201 })
}