import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, quotations, quotationEmailDeliveries } from '@/db/schema'
import {
    canManageQuotation,
    parseQuotationData,
    snapshotCompany
} from '@/lib/cotizaciones/quotation'
import { getQuotationEmailSettings } from '@/lib/cotizaciones/email-settings'
import {
    quotationEmailRecipients,
    renderQuotationEmail,
    validateMessage,
    type QuotationEmailContext
} from '@/lib/cotizaciones/email'
import { quotationPdfFilename } from '@/lib/cotizaciones/shared'
import { buildQuotationPdf } from '@/lib/cotizaciones/pdf'
import {
    getTransporter,
    isSmtpConfigured,
    senderAddress,
    SmtpNotConfiguredError
} from '@/lib/email/smtp'
import { isValidEmail } from '@/lib/email/template'

export const runtime = 'nodejs'
type RouteParams = { params: Promise<{ id: string; quotationId: string }> }
async function loadContext(params: RouteParams['params']) {
    const { id, quotationId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return { error: 'No autorizado', status: 401 } as const
    if (!/^\d+$/.test(id) || !/^\d+$/.test(quotationId))
        return { error: 'Cotización no encontrada', status: 404 } as const
    const [row] = await db
        .select()
        .from(quotations)
        .where(
            and(
                eq(quotations.id, Number(quotationId)),
                eq(quotations.customerId, Number(id))
            )
        )
        .limit(1)
    if (!row) return { error: 'Cotización no encontrada', status: 404 } as const
    if (!canManageQuotation(row, session.user))
        return { error: 'No tienes permiso para esta acción', status: 403 } as const
    const data = parseQuotationData(row)
    if (!data)
        return {
            error: 'La cotización no tiene datos para generar el PDF',
            status: 400
        } as const
    const [company, settings, [lead]] = await Promise.all([
        snapshotCompany(),
        getQuotationEmailSettings(),
        db
            .select({ email: customers.email })
            .from(customers)
            .where(eq(customers.id, row.customerId))
            .limit(1)
    ])
    const context: QuotationEmailContext = {
        number: row.number,
        clientName: data.client.name,
        clientEmail: lead?.email || data.client.email || '',
        programName: data.program?.name || data.course?.name || 'Programa de estudios',
        advisorName:
            data.advisor.name ||
            row.advisorName ||
            company.advisorName ||
            session.user.name,
        advisorEmail:
            data.advisor.email ||
            row.advisorEmail ||
            company.advisorEmail ||
            session.user.email,
        company
    }
    return { row, data, context, settings, session }
}
export async function GET(_request: Request, { params }: RouteParams) {
    const loaded = await loadContext(params)
    if ('error' in loaded)
        return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    return NextResponse.json({
        context: loaded.context,
        settings: loaded.settings,
        smtpConfigured: isSmtpConfigured(),
        filename: quotationPdfFilename(loaded.row.number, loaded.data.client.name)
    })
}
export async function POST(request: Request, { params }: RouteParams) {
    const loaded = await loadContext(params)
    if ('error' in loaded)
        return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    const body = await request.json().catch(() => null)
    if (
        !body ||
        typeof body !== 'object' ||
        typeof body.requestId !== 'string' ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)
    )
        return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    const validationError = validateMessage(body.subject, body.message)
    if (validationError)
        return NextResponse.json({ error: validationError }, { status: 400 })
    const recipients = quotationEmailRecipients(
        body.to,
        body.copyCompany,
        loaded.context.company.email
    )
    if ('error' in recipients)
        return NextResponse.json({ error: recipients.error }, { status: 400 })
    if (!isSmtpConfigured())
        return NextResponse.json(
            {
                error: 'El servicio de correo no está configurado. Contacta al administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            },
            { status: 503 }
        )
    const rendered = renderQuotationEmail(body.subject, body.message, loaded.context)
    if (rendered.subject.length > 250)
        return NextResponse.json(
            { error: 'El asunto es demasiado largo después de completar los datos' },
            { status: 400 }
        )
    // A repeated request must never send a second copy after a lost response.
    const [claim] = await db
        .insert(quotationEmailDeliveries)
        .values({
            id: body.requestId,
            quotationId: loaded.row.id,
            sentBy: loaded.session.user.id,
            recipients: JSON.stringify(recipients),
            subject: rendered.subject,
            status: 'sending'
        })
        .onConflictDoNothing()
        .returning()
    if (!claim) {
        const [previous] = await db
            .select()
            .from(quotationEmailDeliveries)
            .where(eq(quotationEmailDeliveries.id, body.requestId))
            .limit(1)
        if (
            previous?.quotationId === loaded.row.id &&
            previous.sentBy === loaded.session.user.id &&
            previous.status === 'sent'
        )
            return NextResponse.json({
                success: true,
                quotationStatus: loaded.row.status
            })
        return NextResponse.json(
            {
                error: 'Esta solicitud ya fue procesada o sigue en curso. Revisa el resultado antes de volver a enviar.',
                code: 'ALREADY_PROCESSING'
            },
            { status: 409 }
        )
    }
    let acceptedByProvider = false
    try {
        const pdf = await buildQuotationPdf(loaded.data, loaded.row.number)
        const result = await getTransporter().sendMail({
            from: senderAddress(),
            to: recipients.to,
            cc: recipients.cc,
            replyTo: isValidEmail(loaded.context.advisorEmail)
                ? loaded.context.advisorEmail
                : undefined,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            attachments: [
                {
                    filename: quotationPdfFilename(
                        loaded.row.number,
                        loaded.data.client.name
                    ),
                    content: pdf,
                    contentType: 'application/pdf'
                }
            ]
        })
        acceptedByProvider = Array.isArray(result.accepted) && result.accepted.length > 0
        if (!acceptedByProvider) throw new Error('No recipients accepted')
        const partial = Array.isArray(result.rejected) && result.rejected.length > 0
        await db
            .update(quotationEmailDeliveries)
            .set({
                status: partial ? 'partial' : 'sent',
                providerId: result.messageId || null
            })
            .where(eq(quotationEmailDeliveries.id, claim.id))
        let quotationStatus = loaded.row.status
        if (!partial && loaded.row.status === 'draft') {
            const [updated] = await db
                .update(quotations)
                .set({ status: 'sent' })
                .where(
                    and(eq(quotations.id, loaded.row.id), eq(quotations.status, 'draft'))
                )
                .returning({ status: quotations.status })
            if (updated) quotationStatus = updated.status
        }
        return NextResponse.json({
            success: true,
            quotationStatus,
            partial,
            warning: partial
                ? 'El servidor aceptó algunos destinatarios, pero rechazó otros. No reenvíes a todos: comprueba los correos antes de repetir el envío.'
                : undefined
        })
    } catch (error) {
        if (acceptedByProvider)
            return NextResponse.json({
                success: true,
                warning:
                    'El servidor aceptó el correo, pero no se pudo actualizar el registro. No vuelvas a enviarlo.'
            })
        await db
            .update(quotationEmailDeliveries)
            .set({ status: 'failed' })
            .where(eq(quotationEmailDeliveries.id, claim.id))
        const notConfigured = error instanceof SmtpNotConfiguredError
        return NextResponse.json(
            {
                error: notConfigured
                    ? 'El servicio de correo no está configurado.'
                    : 'No se pudo confirmar el envío. Comprueba el servicio de correo antes de volver a intentarlo.',
                code: notConfigured ? 'SMTP_NOT_CONFIGURED' : 'SEND_FAILED'
            },
            { status: notConfigured ? 503 : 502 }
        )
    }
}
