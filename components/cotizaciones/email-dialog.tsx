'use client'

import { useRef, useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { QuotationStatus } from '@/lib/cotizaciones/shared'
import {
    fillQuotationEmail,
    renderQuotationEmail,
    validateMessage,
    quotationEmailRecipients,
    type QuotationEmailContext,
    type QuotationEmailSettings
} from '@/lib/cotizaciones/email'

type EmailDraft = {
    context: QuotationEmailContext
    settings: QuotationEmailSettings
    smtpConfigured: boolean
    filename: string
}
export function QuotationEmailDialog({
    customerId,
    quotationId,
    onSent
}: {
    customerId: number
    quotationId: number
    onSent: (status?: QuotationStatus) => void
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [data, setData] = useState<EmailDraft | null>(null)
    const [to, setTo] = useState('')
    const [copyCompany, setCopyCompany] = useState(false)
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [templateId, setTemplateId] = useState('')
    const requestId = useRef('')
    const busy = useRef(false)
    const endpoint = `/api/customers/${customerId}/quotations/${quotationId}/email`
    async function show() {
        if (busy.current) return
        busy.current = true
        setLoading(true)
        try {
            const response = await fetch(endpoint)
            const body = await response.json()
            if (!response.ok)
                throw new Error(body.error || 'No se pudo preparar el correo')
            const loaded = body as EmailDraft
            setData(loaded)
            setTo(loaded.context.clientEmail)
            setCopyCompany(loaded.settings.copyCompany)
            const template =
                loaded.settings.templates.find(
                    (item) => item.id === loaded.settings.defaultTemplateId
                ) || loaded.settings.templates[0]
            setTemplateId(template?.id || '')
            setSubject(
                template
                    ? fillQuotationEmail(template.subject, loaded.context)
                    : `Cotización ${loaded.context.number} — ${loaded.context.programName}`
            )
            setMessage(
                template ? fillQuotationEmail(template.message, loaded.context) : ''
            )
            requestId.current = crypto.randomUUID()
            setOpen(true)
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Error preparando correo'
            )
        } finally {
            setLoading(false)
            busy.current = false
        }
    }
    async function send() {
        if (!data || busy.current) return
        const validation = validateMessage(subject, message)
        const recipients = quotationEmailRecipients(
            to,
            copyCompany,
            data.context.company.email
        )
        if (validation || 'error' in recipients) {
            toast.error(
                validation ||
                    ('error' in recipients ? recipients.error : 'Destinatarios inválidos')
            )
            return
        }
        busy.current = true
        setSending(true)
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: requestId.current,
                    to,
                    copyCompany,
                    subject,
                    message
                })
            })
            const body = await response.json()
            if (!response.ok) {
                // Keep the id on uncertain/in-progress results to prevent duplicate sends.
                if (response.status === 400 || response.status === 503)
                    requestId.current = crypto.randomUUID()
                throw new Error(body.error || 'No se pudo enviar el correo')
            }
            if (body.warning) toast.warning(body.warning)
            else
                toast.success(
                    'Cotización enviada al servidor de correo con el PDF adjunto'
                )
            if (!body.partial) onSent(body.quotationStatus)
            setOpen(false)
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'No se pudo confirmar el envío. No cierres esta ventana y comprueba el resultado antes de reintentar.'
            )
        } finally {
            setSending(false)
            busy.current = false
        }
    }
    const preview = data ? renderQuotationEmail(subject, message, data.context) : null
    return (
        <>
            <Button variant="outline" size="sm" onClick={show} disabled={loading}>
                <Mail className="mr-2 size-4" />
                {loading ? 'Preparando…' : 'Enviar por correo'}
            </Button>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!sending) setOpen(value)
                }}
            >
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Enviar cotización por correo</DialogTitle>
                        <DialogDescription>
                            Revisa destinatarios, mensaje y vista previa. El PDF de la
                            cotización guardada se adjuntará al enviar.
                        </DialogDescription>
                    </DialogHeader>
                    {data && (
                        <>
                            {!data.smtpConfigured && (
                                <p
                                    role="alert"
                                    className="rounded border border-destructive p-3 text-sm text-destructive"
                                >
                                    El servicio de correo no está configurado. Contacta al
                                    administrador para habilitar los envíos.
                                </p>
                            )}
                            <div className="grid gap-5 lg:grid-cols-2">
                                <fieldset
                                    disabled={sending}
                                    className="space-y-4 min-w-0"
                                >
                                    <div>
                                        <label
                                            htmlFor="quotation-email-to"
                                            className="text-sm font-medium"
                                        >
                                            Para
                                        </label>
                                        <Input
                                            id="quotation-email-to"
                                            value={to}
                                            onChange={(event) =>
                                                setTo(event.target.value)
                                            }
                                            placeholder="cliente@ejemplo.com, otro@ejemplo.com"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Hasta 10 correos separados por coma.
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={copyCompany}
                                            onCheckedChange={(value) =>
                                                setCopyCompany(value === true)
                                            }
                                        />
                                        Enviar copia a la empresa (
                                        {data.context.company.email ||
                                            'correo sin configurar'}
                                        )
                                    </label>
                                    <div>
                                        <label
                                            htmlFor="quotation-email-template"
                                            className="text-sm font-medium"
                                        >
                                            Plantilla
                                        </label>
                                        <select
                                            id="quotation-email-template"
                                            className="w-full rounded-md border bg-background p-2 text-sm"
                                            value={templateId}
                                            onChange={(event) => {
                                                const template =
                                                    data.settings.templates.find(
                                                        (item) =>
                                                            item.id === event.target.value
                                                    )
                                                setTemplateId(event.target.value)
                                                if (template) {
                                                    setSubject(
                                                        fillQuotationEmail(
                                                            template.subject,
                                                            data.context
                                                        )
                                                    )
                                                    setMessage(
                                                        fillQuotationEmail(
                                                            template.message,
                                                            data.context
                                                        )
                                                    )
                                                }
                                            }}
                                        >
                                            <option value="">
                                                Mensaje personalizado
                                            </option>
                                            {data.settings.templates.map((template) => (
                                                <option
                                                    key={template.id}
                                                    value={template.id}
                                                >
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="quotation-email-subject"
                                            className="text-sm font-medium"
                                        >
                                            Asunto
                                        </label>
                                        <Input
                                            id="quotation-email-subject"
                                            maxLength={200}
                                            value={subject}
                                            onChange={(event) =>
                                                setSubject(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="quotation-email-message"
                                            className="text-sm font-medium"
                                        >
                                            Mensaje
                                        </label>
                                        <textarea
                                            id="quotation-email-message"
                                            className="min-h-64 w-full rounded-md border bg-background p-3 text-sm"
                                            maxLength={12000}
                                            value={message}
                                            onChange={(event) =>
                                                setMessage(event.target.value)
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            La firma del asesor y los datos de S Travel se
                                            añaden automáticamente. Los cambios aquí solo
                                            afectan este envío.
                                        </p>
                                    </div>
                                    <p className="break-all rounded-md bg-muted p-3 text-xs">
                                        Adjunto:{' '}
                                        <a
                                            className="underline"
                                            href={`/api/customers/${customerId}/quotations/${quotationId}/pdf`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {data.filename}
                                        </a>
                                    </p>
                                </fieldset>
                                <div className="min-w-0">
                                    <h3 className="mb-2 text-sm font-medium">
                                        Vista previa
                                    </h3>
                                    <iframe
                                        title="Vista previa del correo de cotización"
                                        sandbox=""
                                        srcDoc={preview?.html}
                                        className="h-[620px] w-full rounded-md border bg-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    disabled={sending}
                                    onClick={() => setOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    disabled={sending || !data.smtpConfigured}
                                    onClick={send}
                                >
                                    {sending ? (
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                    ) : (
                                        <Mail className="mr-2 size-4" />
                                    )}
                                    {sending ? 'Enviando…' : 'Enviar correo con PDF'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
