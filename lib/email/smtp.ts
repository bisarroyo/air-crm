import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transporte SMTP para las campañas masivas.
 *
 * Configuración por entorno (ver README de esta carpeta):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
 *   SMTP_FROM_NAME, SMTP_FROM_ADDRESS, SMTP_BCC
 *
 * Si faltan las credenciales el envío falla con un mensaje claro en vez de
 * fallar en silencio, para que el error de la campaña lo muestre la interfaz.
 */
export type SmtpSettings = {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    fromName: string
    fromAddress: string
    bcc: string
}

export class SmtpNotConfiguredError extends Error {
    constructor() {
        super(
            'SMTP no está configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en .env'
        )
        this.name = 'SmtpNotConfiguredError'
    }
}

export function smtpSettings(): SmtpSettings {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
        throw new SmtpNotConfiguredError()
    }

    const port = Number(process.env.SMTP_PORT) || 587

    return {
        host,
        port,
        // El puerto 465 es SSL implícito; cualquier otro usa STARTTLS.
        secure:
            process.env.SMTP_SECURE !== undefined
                ? process.env.SMTP_SECURE === 'true'
                : port === 465,
        user,
        pass,
        fromName:
            process.env.SMTP_FROM_NAME?.trim() ||
            process.env.SMTP_FROM_ADDRESS?.trim() ||
            'Notificaciones',
        fromAddress:
            process.env.SMTP_FROM_ADDRESS?.trim() || user,
        bcc: process.env.SMTP_BCC?.trim() || ''
    }
}

export function isSmtpConfigured(): boolean {
    try {
        smtpSettings()
        return true
    } catch {
        return false
    }
}

let transporter: Transporter | null = null
let transporterKey = ''

export function getTransporter(): Transporter {
    const settings = smtpSettings()
    const key = [
        settings.host,
        settings.port,
        settings.secure,
        settings.user
    ].join('|')

    // Se reutiliza la conexión entre lotes del mismo servidor (pooling).
    if (!transporter || transporterKey !== key) {
        transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            secure: settings.secure,
            auth: { user: settings.user, pass: settings.pass },
            pool: true,
            maxConnections: 3,
            maxMessages: 50,
            connectionTimeout: 15_000,
            greetingTimeout: 15_000,
            socketTimeout: 30_000
        })
        transporterKey = key
    }

    return transporter
}

export function senderAddress(): { name: string; address: string } {
    const settings = smtpSettings()
    return { name: settings.fromName, address: settings.fromAddress }
}