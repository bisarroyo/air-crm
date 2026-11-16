import { escapeHtml, isValidEmail, parseAddressList } from '../email/template'
import type { QuotationCompany } from './shared'

export interface QuotationEmailTemplate {
    id: string
    name: string
    subject: string
    message: string
}
export interface QuotationEmailSettings {
    copyCompany: boolean
    defaultTemplateId: string | null
    templates: QuotationEmailTemplate[]
}
export interface QuotationEmailContext {
    number: string
    clientName: string
    clientEmail: string
    programName: string
    advisorName: string
    advisorEmail: string
    company: QuotationCompany
}
export const QUOTATION_EMAIL_VARIABLES = [
    'cliente',
    'programa',
    'numero',
    'asesor',
    'empresa',
    'email_asesor',
    'email_empresa'
] as const
export const DEFAULT_QUOTATION_EMAIL_SETTINGS: QuotationEmailSettings = {
    copyCompany: true,
    defaultTemplateId: 'formal',
    templates: [
        {
            id: 'formal',
            name: 'Presentación formal',
            subject: 'Cotización {{numero}} — {{programa}} | {{empresa}}',
            message:
                'Estimado/a {{cliente}}:\n\nReciba un cordial saludo de {{empresa}}.\n\nAdjuntamos la cotización correspondiente al programa {{programa}}, con el detalle de los servicios, los costos y las condiciones de la propuesta.\n\nQuedamos a su disposición para aclarar cualquier consulta o realizar los ajustes que necesite. Será un gusto acompañarle en los próximos pasos.\n\nAtentamente,'
        }
    ]
}
export function validateEmailSettings(value: unknown): string | null {
    if (!value || typeof value !== 'object') return 'Configuración de email inválida'
    const v = value as QuotationEmailSettings
    if (
        typeof v.copyCompany !== 'boolean' ||
        !Array.isArray(v.templates) ||
        v.templates.length > 30
    )
        return 'Configuración de email inválida'
    const ids = new Set<string>()
    for (const template of v.templates) {
        if (
            !template ||
            typeof template.id !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(template.id) ||
            ids.has(template.id)
        )
            return 'Identificador de plantilla inválido o repetido'
        ids.add(template.id)
        if (
            typeof template.name !== 'string' ||
            !template.name.trim() ||
            template.name.length > 100
        )
            return 'Cada plantilla debe tener un nombre (máximo 100 caracteres)'
        const error = validateMessage(template.subject, template.message)
        if (error) return error
    }
    if (v.defaultTemplateId !== null && !ids.has(v.defaultTemplateId))
        return 'Selecciona una plantilla predeterminada válida'
    return null
}
export function validateMessage(subject: unknown, message: unknown): string | null {
    if (
        typeof subject !== 'string' ||
        !subject.trim() ||
        subject.length > 200 ||
        /[\r\n]/.test(subject)
    )
        return 'El asunto es obligatorio, sin saltos de línea y de máximo 200 caracteres'
    if (typeof message !== 'string' || !message.trim() || message.length > 12000)
        return 'El mensaje es obligatorio y admite hasta 12000 caracteres'
    const unknown = [
        ...`${subject} ${message}`.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)
    ].find(
        (match) =>
            !QUOTATION_EMAIL_VARIABLES.includes(
                match[1].trim() as (typeof QUOTATION_EMAIL_VARIABLES)[number]
            )
    )
    return unknown ? `Variable no reconocida: ${unknown[0]}` : null
}
export function fillQuotationEmail(text: string, context: QuotationEmailContext): string {
    const vars: Record<string, string> = {
        cliente: context.clientName,
        programa: context.programName,
        numero: context.number,
        asesor: context.advisorName,
        empresa: context.company.companyName,
        email_asesor: context.advisorEmail,
        email_empresa: context.company.email || ''
    }
    return text.replace(
        /\{\{\s*([a-z_]+)\s*\}\}/g,
        (match, key: string) => vars[key] ?? match
    )
}
export function quotationEmailRecipients(
    to: unknown,
    copyCompany: unknown,
    companyEmail: string | null
) {
    if (typeof to !== 'string' || to.length > 2600 || typeof copyCompany !== 'boolean')
        return { error: 'Destinatarios inválidos' } as const
    const recipients = parseAddressList(to)
    if (
        !recipients.length ||
        recipients.length > 10 ||
        recipients.some((email) => !isValidEmail(email))
    )
        return {
            error: 'Introduce de 1 a 10 correos válidos, separados por coma'
        } as const
    if (copyCompany && !isValidEmail(companyEmail))
        return {
            error: 'Configura un correo válido de empresa o desmarca la copia'
        } as const
    return {
        to: recipients,
        cc:
            copyCompany &&
            !recipients.some(
                (email) => email.toLowerCase() === companyEmail!.toLowerCase()
            )
                ? [companyEmail!.trim()]
                : []
    }
}
export function renderQuotationEmail(
    subject: string,
    message: string,
    context: QuotationEmailContext
) {
    const renderedSubject = fillQuotationEmail(subject, context)
        .replace(/[\r\n]+/g, ' ')
        .trim()
    const renderedMessage = fillQuotationEmail(message, context)
    const company = context.company
    const signature = [
        context.advisorName,
        context.advisorEmail,
        company.companyName,
        company.email,
        company.phone && `Teléfono: ${company.phone}`,
        company.whatsapp && `WhatsApp: ${company.whatsapp}`,
        company.website,
        company.address
    ].filter(Boolean) as string[]
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6f6;color:#172b2a;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:auto;background:#fff;border:1px solid #dce7e5;border-radius:12px;overflow:hidden"><tr><td style="padding:28px;background:#0f766e;color:white"><div style="font-size:23px;font-weight:bold">${escapeHtml(company.companyName)}</div><div style="margin-top:8px;font-size:14px">Cotización ${escapeHtml(context.number)}</div></td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.65"><div style="font-size:18px;font-weight:bold;margin-bottom:20px">${escapeHtml(context.programName)}</div>${escapeHtml(renderedMessage).replace(/\n/g, '<br>')}<div style="margin-top:24px;padding-top:20px;border-top:1px solid #dce7e5">${signature.map((line, index) => `<div${index === 0 ? ' style="font-weight:bold;color:#0f766e"' : ''}>${escapeHtml(line)}</div>`).join('')}</div><div style="margin-top:24px;padding:14px;background:#f0fdfa;border-radius:6px;font-size:13px">Documento adjunto: cotización ${escapeHtml(context.number)} en PDF.</div></td></tr></table></td></tr></table></body></html>`
    return {
        subject: renderedSubject,
        html,
        text: `${renderedMessage}\n\n${signature.join('\n')}\n\nDocumento adjunto: cotización ${context.number} en PDF.`
    }
}
