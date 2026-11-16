import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailSenderSettings } from '@/db/schema'
import { getEmailSenderSettings } from '@/lib/email/sender-settings'

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    try {
        return NextResponse.json({ ...await getEmailSenderSettings(), canEdit: session.user.role === 'admin' })
    } catch {
        return NextResponse.json({ error: 'No se pudo cargar la configuración' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'admin')
        return NextResponse.json({ error: 'Solo un administrador puede cambiar el remitente' }, { status: 403 })
    const body = await request.json().catch(() => null)
    const fromName = typeof body?.fromName === 'string' ? body.fromName.trim() : ''
    if (!fromName || fromName.length > 120 || /[\r\n\x00-\x1f\x7f]/.test(body.fromName))
        return NextResponse.json({ error: 'Escribe un nombre de 1 a 120 caracteres, sin saltos de línea' }, { status: 400 })
    try {
        await db.insert(emailSenderSettings).values({ id: 1, fromName })
            .onConflictDoUpdate({ target: emailSenderSettings.id, set: { fromName } })
        return NextResponse.json({ ...await getEmailSenderSettings(), canEdit: true })
    } catch {
        return NextResponse.json({ error: 'No se pudo guardar la configuración' }, { status: 500 })
    }
}
