import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
    emailCampaigns,
    emailCampaignRecipients,
    type EmailCampaignStatus
} from '@/db/schema'
import { CAMPAIGN_MAX_RECIPIENTS } from './constants'
import { loadRecipients } from './recipients'
import {
    htmlToText,
    isValidEmail,
    parseAddressList,
    renderTemplate,
    renderTemplateHtml,
    unknownVariables,
    wrapEmailHtml
} from './template'
import { buildTemplateVars, type RecipientContext } from './variables'
import {
    getTransporter,
    isSmtpConfigured,
    smtpSettings
} from './smtp'

export const CAMPAIGN_MODES = ['visual', 'html'] as const
export type CampaignMode = (typeof CAMPAIGN_MODES)[number]

/** Cuántos correos envía cada llamada. El navegador va repitiendo en bucle. */
export const DEFAULT_BATCH_SIZE = 5
export const MAX_BATCH_SIZE = 20

export type Actor = { id: string; role: string | null | undefined }

/**
 * Admin puede tocar cualquier campaña; cualquier otro rol solo las que él
 * creó. `null` significa "sin filtro de dueño".
 */
export function campaignOwnerScope(actor: Actor): string | null {
    return actor.role === 'admin' ? null : actor.id
}

export type CampaignTotals = {
    total: number
    sent: number
    failed: number
    skipped: number
    pending: number
}

export type CreateCampaignInput = {
    name: string
    subject: string
    bodyHtml: string
    mode: string
    bcc: string
    customerIds: number[]
}

/** Valida la entrada y devuelve el mensaje de error, o `null` si todo está bien. */
export function validateCampaignInput(input: CreateCampaignInput): string | null {
    if (!input.subject.trim()) return 'El asunto es obligatorio'
    if (!input.bodyHtml.trim()) return 'El mensaje no puede estar vacío'

    const customerIds = [...new Set(input.customerIds.filter(Number.isInteger))]
    if (customerIds.length === 0) return 'Selecciona al menos un cliente'
    if (customerIds.length > CAMPAIGN_MAX_RECIPIENTS) {
        return `Una campaña no puede superar ${CAMPAIGN_MAX_RECIPIENTS} destinatarios`
    }

    const badBcc = parseAddressList(input.bcc).filter(
        (address) => !isValidEmail(address)
    )
    if (badBcc.length > 0) {
        return `Bcc inválido: ${badBcc.join(', ')}`
    }

    const unknown = [
        ...unknownVariables(input.subject),
        ...unknownVariables(input.bodyHtml)
    ]
    if (unknown.length > 0) {
        return `Variables desconocidas: ${unknown.join(', ')}. Revisa la lista de variables disponibles.`
    }

    return null
}

export async function createCampaign(
    input: CreateCampaignInput,
    actor: Actor
) {
    const invalid = validateCampaignInput(input)
    if (invalid) return { error: invalid, status: 400 as const }

    const ownerId = campaignOwnerScope(actor)
    const recipients = await loadRecipients(input.customerIds, ownerId)

    if (recipients.length === 0) {
        return {
            error: 'No tienes permiso para enviar a esos clientes',
            status: 403 as const
        }
    }

    const mode: CampaignMode = CAMPAIGN_MODES.includes(
        input.mode as CampaignMode
    )
        ? (input.mode as CampaignMode)
        : 'visual'

    const bcc = parseAddressList(input.bcc)

    const [campaign] = await db
        .insert(emailCampaigns)
        .values({
            name: input.name.trim() || input.subject.trim(),
            subject: input.subject.trim(),
            bodyHtml: input.bodyHtml.trim(),
            mode,
            bcc: bcc.length > 0 ? bcc.join(', ') : null,
            createdBy: actor.id,
            recipientCount: recipients.length
        })
        .returning({ id: emailCampaigns.id })

    if (!campaign) {
        return { error: 'No se pudo crear la campaña', status: 500 as const }
    }

    await db.insert(emailCampaignRecipients).values(
        recipients.map((recipient) => ({
            campaignId: campaign.id,
            customerId: recipient.customerId,
            name: recipient.name,
            email: recipient.email,
            status: recipient.skipReason ? ('skipped' as const) : ('pending' as const),
            error: recipient.skipReason
        }))
    )

    return {
        id: campaign.id,
        recipientCount: recipients.length,
        skipped: recipients.filter((r) => r.skipReason).length,
        smtpConfigured: isSmtpConfigured(),
        sender: isSmtpConfigured() ? smtpSettings().fromAddress : null,
        status: 201 as const
    }
}

export async function listCampaigns(actor: Actor) {
    const ownerId = campaignOwnerScope(actor)

    const rows = await db
        .select()
        .from(emailCampaigns)
        .where(ownerId ? eq(emailCampaigns.createdBy, ownerId) : undefined)
        .orderBy(desc(emailCampaigns.createdAt))
        .limit(100)

    return rows
}

export async function getCampaignDetail(campaignId: number, actor: Actor) {
    const ownerId = campaignOwnerScope(actor)

    const rows = await db
        .select()
        .from(emailCampaigns)
        .where(
            ownerId
                ? and(
                      eq(emailCampaigns.id, campaignId),
                      eq(emailCampaigns.createdBy, ownerId)
                  )
                : eq(emailCampaigns.id, campaignId)
        )
        .limit(1)

    const campaign = rows[0]
    if (!campaign) return null

    const recipients = await db
        .select()
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, campaignId))
        .orderBy(emailCampaignRecipients.id)

    return { campaign, recipients }
}

export async function deleteCampaign(campaignId: number, actor: Actor) {
    const detail = await getCampaignDetail(campaignId, actor)
    if (!detail) return { error: 'Campaña no encontrada', status: 404 as const }
    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaignId))
    return { status: 200 as const }
}

async function campaignTotals(campaignId: number): Promise<CampaignTotals> {
    const rows = await db
        .select({ status: emailCampaignRecipients.status })
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, campaignId))

    return {
        total: rows.length,
        sent: rows.filter((row) => row.status === 'sent').length,
        failed: rows.filter((row) => row.status === 'failed').length,
        skipped: rows.filter((row) => row.status === 'skipped').length,
        pending: rows.filter((row) => row.status === 'pending').length
    }
}

async function markCampaignStatus(
    campaignId: number,
    status: EmailCampaignStatus,
    extra: Record<string, unknown> = {}
) {
    await db
        .update(emailCampaigns)
        .set({ status, ...extra })
        .where(eq(emailCampaigns.id, campaignId))
}

async function finalizeCampaign(campaignId: number) {
    const totals = await campaignTotals(campaignId)
    await markCampaignStatus(campaignId, 'completed', {
        completedAt: new Date(),
        sentCount: totals.sent,
        failedCount: totals.failed,
        skippedCount: totals.skipped
    })
}

export async function resetFailedRecipients(
    campaignId: number,
    actor: Actor
) {
    const detail = await getCampaignDetail(campaignId, actor)
    if (!detail) return { error: 'Campaña no encontrada', status: 404 as const }

    await db
        .update(emailCampaignRecipients)
        .set({ status: 'pending', error: null })
        .where(
            and(
                eq(emailCampaignRecipients.campaignId, campaignId),
                inArray(emailCampaignRecipients.status, ['failed'])
            )
        )

    await markCampaignStatus(campaignId, 'sending')

    return { status: 200 as const }
}

/**
 * Envía un lote de destinatarios pendientes y guarda el resultado de cada uno.
 *
 * En Vercel cada request tiene un límite de tiempo (~60s), así que el navegador
 * llama esta función en bucle con lotes pequeños. Como el resultado se guarda
 * en la base, cerrar la pestaña no pierde lo ya enviado y se puede continuar
 * después desde donde quedó.
 */
export async function sendBatch(
    campaignId: number,
    actor: Actor,
    batchSize: number
) {
    const detail = await getCampaignDetail(campaignId, actor)
    if (!detail) {
        return { error: 'Campaña no encontrada', status: 404 as const }
    }

    const campaign = detail.campaign

    if (campaign.status === 'completed') {
        return { error: 'La campaña ya terminó', status: 400 as const }
    }

    const size = Math.min(
        Math.max(1, Number(batchSize) || DEFAULT_BATCH_SIZE),
        MAX_BATCH_SIZE
    )

    const pending = await db
        .select({
            id: emailCampaignRecipients.id,
            customerId: emailCampaignRecipients.customerId,
            name: emailCampaignRecipients.name,
            email: emailCampaignRecipients.email
        })
        .from(emailCampaignRecipients)
        .where(
            and(
                eq(emailCampaignRecipients.campaignId, campaignId),
                eq(emailCampaignRecipients.status, 'pending')
            )
        )
        .orderBy(emailCampaignRecipients.id)
        .limit(size)

    if (pending.length === 0) {
        await finalizeCampaign(campaignId)
        const totals = await campaignTotals(campaignId)
        return { done: true, ...totals, status: 200 as const }
    }

    const customerIds = pending
        .map((row) => row.customerId)
        .filter((id): id is number => id != null)

    const loaded = await loadRecipients(customerIds, null)
    const contextByCustomer = new Map(
        loaded.map((recipient) => [recipient.customerId, recipient.context])
    )

    // Se resuelve el transporte ANTES de marcar la campaña como "sending": si
    // falta configuración no debe quedar una campaña a medio enviar.
    let transporter: ReturnType<typeof getTransporter>
    let from: ReturnType<typeof smtpSettings>
    try {
        transporter = getTransporter()
        from = smtpSettings()
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'SMTP no está configurado'
        return { error: message, status: 503 as const }
    }

    // La copia oculta de la campaña manda; si no hay, la del .env (SMTP_BCC).
    const bcc =
        parseAddressList(campaign.bcc).length > 0
            ? parseAddressList(campaign.bcc)
            : parseAddressList(from.bcc)

    if (campaign.status === 'draft') {
        await markCampaignStatus(campaignId, 'sending', {
            startedAt: new Date()
        })
    }
    const fallbackContext = (name: string, email: string): RecipientContext => ({
        name,
        email,
        phone: null,
        country: null,
        statusName: null,
        priorityName: null,
        tags: [],
        advisorName: null,
        lastQuotationNumber: null,
        lastQuotationTotal: null,
        lastQuotationCurrency: null
    })

    let processed = 0

    for (const row of pending) {
        const email = (row.email || '').trim()

        if (!isValidEmail(email)) {
            await db
                .update(emailCampaignRecipients)
                .set({
                    status: 'skipped',
                    error: 'Email inválido o vacío'
                })
                .where(eq(emailCampaignRecipients.id, row.id))
            processed++
            continue
        }

        const context =
            (row.customerId != null
                ? contextByCustomer.get(row.customerId)
                : undefined) ?? fallbackContext(row.name, email)

        const vars = buildTemplateVars(context)

        try {
            await transporter.sendMail({
                from: { name: from.fromName, address: from.fromAddress },
                to: email,
                ...(bcc.length > 0 ? { bcc } : {}),
                subject: renderTemplate(campaign.subject, vars),
                html: wrapEmailHtml(renderTemplateHtml(campaign.bodyHtml, vars)),
                text: htmlToText(renderTemplate(campaign.bodyHtml, vars))
            })

            await db
                .update(emailCampaignRecipients)
                .set({ status: 'sent', sentAt: new Date(), error: null })
                .where(eq(emailCampaignRecipients.id, row.id))
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'Error desconocido'
            await db
                .update(emailCampaignRecipients)
                .set({
                    status: 'failed',
                    error: message.slice(0, 500)
                })
                .where(eq(emailCampaignRecipients.id, row.id))
        }

        processed++
    }

    const remainingRow = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailCampaignRecipients)
        .where(
            and(
                eq(emailCampaignRecipients.campaignId, campaignId),
                eq(emailCampaignRecipients.status, 'pending')
            )
        )

    const remaining = Number(remainingRow[0]?.count ?? 0)

    if (remaining === 0) {
        await finalizeCampaign(campaignId)
    }

    const totals = await campaignTotals(campaignId)

    return {
        done: remaining === 0,
        processed,
        ...totals,
        status: 200 as const
    }
}

/**
 * Envía una sola copia a unTester con los datos de un cliente real, para
 * revisar el correo antes de salir a todos.
 */
export async function sendTestEmail(input: {
    to: string
    subject: string
    bodyHtml: string
    bcc: string
    customerId: number | null
}) {
    if (!isValidEmail(input.to)) {
        return { error: 'El email de prueba no es válido', status: 400 as const }
    }

    let bcc = parseAddressList(input.bcc).filter((address) =>
        isValidEmail(address)
    )
    if (bcc.length === 0) {
        // Sin Bcc en pantalla se cae al del .env (SMTP_BCC).
        bcc = parseAddressList(process.env.SMTP_BCC ?? '').filter((address) =>
            isValidEmail(address)
        )
    }

    const loaded = input.customerId != null
        ? await loadRecipients([input.customerId], null)
        : []

    const context: RecipientContext =
        loaded[0]?.context ?? {
            name: 'Cliente de ejemplo',
            email: input.to,
            phone: '+00 0000 0000',
            country: 'País',
            statusName: 'Nuevo',
            priorityName: 'Media',
            tags: ['Ejemplo', 'Demo'],
            advisorName: 'Asesor',
            lastQuotationNumber: 'ST-0000-0000',
            lastQuotationTotal: null,
            lastQuotationCurrency: null
        }

    const vars = buildTemplateVars(context)

    try {
        const transporter = getTransporter()
        const from = smtpSettings()

        await transporter.sendMail({
            from: { name: from.fromName, address: from.fromAddress },
            to: input.to,
            // La copia oculta también se aplica al correo de prueba.
            ...(bcc.length > 0 ? { bcc } : {}),
            subject: `[PRUEBA] ${renderTemplate(input.subject, vars)}`,
            html: wrapEmailHtml(renderTemplateHtml(input.bodyHtml, vars)),
            text: htmlToText(renderTemplate(input.bodyHtml, vars))
        })

        return { status: 200 as const }
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'No se pudo enviar el correo'
        return { error: message, status: 502 as const }
    }
}