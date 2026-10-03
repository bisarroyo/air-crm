import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isSmtpConfigured } from '@/lib/email/smtp'
import { isCloudinaryConfigured } from '@/lib/email/cloudinary'

/**
 * Solo devuelve si cada integración está configurada (nunca los valores), para
 * que la interfaz pueda avisar antes de dejar escribir o enviar.
 */
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
        smtpConfigured: isSmtpConfigured(),
        cloudinaryConfigured: isCloudinaryConfigured()
    })
}