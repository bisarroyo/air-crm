'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    AlertTriangle,
    Eye,
    Info,
    Loader2,
    Mail,
    Pencil,
    Send,
    Sparkles,
    TestTube2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { BodyEditor } from './body-editor'
import { useInsertAtCursor } from '@/hooks/use-insert-at-cursor'
import {
    CustomerPicker,
    type SelectedRecipient
} from './customer-picker'
import { CampaignHistory } from './campaign-history'
import { TemplatePresets } from './template-presets'
import type { BodyMode } from './body-editor'
import { TemplateManager } from './template-manager'
import type { StoredEmailTemplate } from '@/lib/email/presets'
import {
    TEMPLATE_VARIABLES,
    invalidAddresses,
    parseAddressList,
    unknownVariables,
    usedVariables
} from '@/lib/email/template'

/** Lotes de 5 con 1s de pausa: ritmo seguro para nounar a spam. */
const BATCH_SIZE = 5
const BATCH_PAUSE_MS = 1000

const DEFAULT_SUBJECT = 'Hola {{nombre_primero}}, tenemos algo para vos'

const DEFAULT_BODY = `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Escribimos desde S Travel Costa Rica porque nos interesa que conozcas nuestros programas de español en Costa Rica.</p>
<p>Si te interesa, con gusto te enviamos la cotización personalizada con los precios de tu caso ({{pais}}).</p>
<p>¡Cualquier duda por aquí!<br>Equipo S Travel</p>`

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const payload = await response.json()
    if (!response.ok) {
        throw new Error(payload.error || 'Error inesperado')
    }
    return payload as T
}

type Progress = {
    campaignId: number
    total: number
    sent: number
    failed: number
    skipped: number
    pending: number
} | null

export function EmailsWorkspace() {
    const queryClient = useQueryClient()
    const statusQuery = useQuery({
        queryKey: ['email-status'],
        queryFn: () =>
            fetchJson<{
                smtpConfigured: boolean
                cloudinaryConfigured: boolean
            }>('/api/emails/status'),
        staleTime: 60_000
    })
    const smtpConfigured = statusQuery.data?.smtpConfigured ?? false
    const abortRef = useRef(false)

    const [tab, setTab] = useState<'compose' | 'templates' | 'history'>(
        'compose'
    )

    const [mode, setMode] = useState<BodyMode>('visual')
    const [selected, setSelected] = useState<Map<number, SelectedRecipient>>(
        new Map()
    )
    const [name, setName] = useState('')
    const [subject, setSubject] = useState(DEFAULT_SUBJECT)
    const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODY)
    const [bcc, setBcc] = useState('')
    const [testTo, setTestTo] = useState('')

    const [preview, setPreview] = useState<{ html: string; subject: string }>(
        { html: '', subject: '' }
    )
    // Permite insertar variables en el punto del cursor, no al final.
    const subjectField = useInsertAtCursor<HTMLInputElement>()

    const [progress, setProgress] = useState<Progress>(null)
    // Espejo del progreso: `onSuccess` se ejecuta después de los renders y
    // leería el valor viejo del state.
    const progressRef = useRef<Progress>(null)

    const badBcc = useMemo(() => invalidAddresses(bcc), [bcc])
    const unknown = useMemo(
        () => [...new Set([...unknownVariables(subject), ...unknownVariables(bodyHtml)])],
        [subject, bodyHtml]
    )
    const used = useMemo(
        () => usedVariables(`${subject} ${bodyHtml}`),
        [subject, bodyHtml]
    )

    const reachable = useMemo(
        () => [...selected.values()].filter((r) => r.reachable).length,
        [selected]
    )
    const excluded = selected.size - reachable

    // Vista previa: usa el mismo render que el envío real.
    useEffect(() => {
        const firstReachable = [...selected.values()].find((r) => r.reachable)
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const payload = await fetchJson<{
                        html: string
                        subject: string
                    }>('/api/emails/preview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            subject,
                            bodyHtml,
                            customerId: firstReachable?.id ?? null
                        })
                    })
                    setPreview(payload)
                } catch {
                    setPreview({ html: '', subject: '' })
                }
            })()
        }, 400)
        return () => clearTimeout(timer)
    }, [subject, bodyHtml, selected])

    useEffect(() => {
        return () => {
            abortRef.current = true
        }
    }, [])

    const testMutation = useMutation({
        mutationFn: () => {
            const firstReachable = [...selected.values()].find(
                (r) => r.reachable
            )
            return fetchJson('/api/emails/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testTo.trim(),
                    subject,
                    bodyHtml,
                    bcc,
                    customerId: firstReachable?.id ?? null
                })
            })
        },
        onSuccess: () =>
            toast.success('Correo de prueba enviado', {
                description: 'Revisa la bandeja de entrada (y la copia oculta).'
            }),
        onError: (error: Error) => toast.error(error.message)
    })

    const sendMutation = useMutation({
        mutationFn: async () => {
            abortRef.current = false

            const created = await fetchJson<{
                id: number
                recipientCount: number
                skipped: number
            }>('/api/emails/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    subject,
                    bodyHtml,
                    mode,
                    bcc,
                    customerIds: [...selected.keys()]
                })
            })

            const initial: Progress = {
                campaignId: created.id,
                total: created.recipientCount,
                sent: 0,
                failed: 0,
                skipped: created.skipped,
                pending: created.recipientCount - created.skipped
            }
            progressRef.current = initial
            setProgress(initial)

            // Un request por lote: en Vercel cada uno tiene un límite de tiempo,
            // y como el resultado se guarda, cerrar la pestaña no pierde lo
            // ya enviado.
            while (!abortRef.current) {
                const result = await fetchJson<{
                    done: boolean
                    sent: number
                    failed: number
                    skipped: number
                    pending: number
                    total: number
                }>(`/api/emails/campaigns/${created.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send',
                        batchSize: BATCH_SIZE
                    })
                })

                const next: Progress = {
                    campaignId: created.id,
                    total: result.total,
                    sent: result.sent,
                    failed: result.failed,
                    skipped: result.skipped,
                    pending: result.pending
                }
                progressRef.current = next
                setProgress(next)

                if (result.done) break

                await new Promise((resolve) =>
                    setTimeout(resolve, BATCH_PAUSE_MS)
                )
            }

            return created.id
        },
        onSuccess: (campaignId) => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
            const state = progressRef.current
            toast.success('Campaña enviada', {
                description: `${state?.sent ?? 0} enviados${
                    state?.failed ? `, ${state.failed} fallidos` : ''
                }${state?.skipped ? `, ${state.skipped} excluidos` : ''} · campaña #${campaignId}`
            })
            setProgress(null)
            setTab('history')
        },
        onError: (error: Error) => {
            toast.error('Se detuvo el envío', { description: error.message })
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
            progressRef.current = null
            setProgress(null)
        }
    })

    const canSend =
        smtpConfigured &&
        subject.trim().length > 0 &&
        bodyHtml.trim().length > 0 &&
        reachable > 0 &&
        unknown.length === 0 &&
        badBcc.length === 0 &&
        !sendMutation.isPending

    const applyPreset = (template: StoredEmailTemplate) => {
        setName(template.name)
        setSubject(template.subject)
        setBodyHtml(template.bodyHtml)
        setMode('visual')
        toast.success(`Plantilla "${template.name}" aplicada`, {
            description: 'Revisa el mensaje antes de enviar.'
        })
    }

    const sendTest = () => {
        if (!testTo.trim()) {
            toast.error('Escribe a qué email quieres la prueba')
            return
        }
        testMutation.mutate()
    }

    return (
        <div className='space-y-6'>
            {!smtpConfigured && (
                <div className='flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
                    <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-600' />
                    <div>
                        <p className='font-medium'>
                            SMTP no está configurado
                        </p>
                        <p className='text-muted-foreground mt-0.5 text-xs'>
                            Define <code>SMTP_HOST</code>,{' '}
                            <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{' '}
                            <code>SMTP_PASS</code> y{' '}
                            <code>SMTP_FROM_ADDRESS</code> en el archivo{' '}
                            <code>.env</code> para poder enviar.
                        </p>
                    </div>
                </div>
            )}

            <div className='flex gap-1 border-b'>
                <Button
                    type='button'
                    variant='ghost'
                    className='rounded-b-none border-b-2 border-transparent'
                    onClick={() => setTab('compose')}
                    style={
                        tab === 'compose'
                            ? { borderBottomColor: 'var(--primary)' }
                            : undefined
                    }>
                    <Pencil />
                    Nuevo envío
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    className='rounded-b-none border-b-2 border-transparent'
                    onClick={() => setTab('templates')}
                    style={
                        tab === 'templates'
                            ? { borderBottomColor: 'var(--primary)' }
                            : undefined
                    }>
                    <Sparkles />
                    Plantillas
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    className='rounded-b-none border-b-2 border-transparent'
                    onClick={() => setTab('history')}
                    style={
                        tab === 'history'
                            ? { borderBottomColor: 'var(--primary)' }
                            : undefined
                    }>
                    <Mail />
                    Historial
                </Button>
            </div>

            {tab === 'history' ? (
                <CampaignHistory onSelect={() => setTab('compose')} />
            ) : tab === 'templates' ? (
                <TemplateManager />
            ) : (
                <div className='space-y-6'>
                    <TemplatePresets onApply={applyPreset} />

                    <div className='grid gap-6 lg:grid-cols-[360px_1fr]'>
                        {/* Destinatarios */}
                        <div className='space-y-3'>
                            <div>
                                <h2 className='text-sm font-semibold'>
                                    1. Destinatarios
                                </h2>
                                <p className='text-muted-foreground text-xs'>
                                    Los clientes sin email válido se excluyen
                                    automáticamente.
                                </p>
                            </div>
                            <CustomerPicker
                                selected={selected}
                                onChange={setSelected}
                            />
                        </div>

                        {/* Mensaje */}
                        <div className='space-y-4'>
                            <div>
                                <h2 className='text-sm font-semibold'>
                                    2. Mensaje
                                </h2>
                            </div>

                            <div className='space-y-1.5'>
                                <Label htmlFor='campaign-name'>
                                    Nombre de la campaña
                                </Label>
                                <Input
                                    id='campaign-name'
                                    value={name}
                                    placeholder='Ej: Promo español setiembre'
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                />
                            </div>

                            <div className='space-y-1.5'>
                                <Label htmlFor='campaign-subject'>Asunto</Label>
                                <div className='flex gap-1.5'>
                                    <Input
                                        {...subjectField.cursorProps}
                                        id='campaign-subject'
                                        value={subject}
                                        onChange={(event) =>
                                            setSubject(event.target.value)
                                        }
                                    />
                                    <Select
                                        value={null}
                                        onValueChange={(token) => {
                                            if (token)
                                                subjectField.insert(
                                                    ` ${token}`,
                                                    subject,
                                                    setSubject
                                                )
                                        }}>
                                        <SelectTrigger className='w-[150px] shrink-0'>
                                            {/* Es un select de acción: siempre vuelve
                                                a mostrar "Variable", nunca el token. */}
                                            <SelectValue>Variable</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(['Cliente', 'CRM'] as const).map(
                                                (group) => (
                                                    <SelectGroup key={group}>
                                                        <SelectLabel>
                                                            {group}
                                                        </SelectLabel>
                                                        {TEMPLATE_VARIABLES.filter(
                                                            (variable) =>
                                                                variable.group ===
                                                                group
                                                        ).map((variable) => (
                                                            <SelectItem
                                                                key={variable.token}
                                                                value={variable.token}>
                                                                {variable.token}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <BodyEditor
                                mode={mode}
                                onModeChange={setMode}
                                value={bodyHtml}
                                onChange={setBodyHtml}
                            />

                            <div className='space-y-1.5'>
                                <Label htmlFor='campaign-bcc'>
                                    Copia oculta (Bcc)
                                </Label>
                                <Input
                                    id='campaign-bcc'
                                    value={bcc}
                                    placeholder='respaldo@empresa.com, archivo@empresa.com'
                                    className={
                                        badBcc.length > 0 ? 'border-destructive' : ''
                                    }
                                    onChange={(event) => setBcc(event.target.value)}
                                />
                                <p className='text-muted-foreground text-xs'>
                                    Se aplica a <strong>todos</strong> los correos
                                    enviados, sin que los destinatarios la vean.
                                    {parseAddressList(bcc).length === 0 &&
                                        ' Si lo dejas vacío se usa SMTP_BCC del .env.'}
                                </p>
                                {badBcc.length > 0 && (
                                    <p className='text-destructive text-xs'>
                                        Inválido: {badBcc.join(', ')}
                                    </p>
                                )}
                            </div>

                            {unknown.length > 0 && (
                                <div className='flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'>
                                    <Info className='text-destructive mt-0.5 size-4 shrink-0' />
                                    <div>
                                        <p className='font-medium'>
                                            Variables no reconocidas
                                        </p>
                                        <p className='text-muted-foreground text-xs'>
                                            {unknown.join(', ')} — se enviarán
                                            literalmente como texto.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {used.length > 0 && (
                                <p className='text-muted-foreground text-xs'>
                                    Variables en uso:{' '}
                                    {used.map((token) => (
                                        <code
                                            key={token}
                                            className='mr-1 rounded bg-muted px-1'>
                                            {token}
                                        </code>
                                    ))}
                                </p>
                            )}

                            {/* Envío */}
                            <div className='space-y-3 rounded-md border p-3'>
                                <div className='flex flex-wrap items-end gap-2'>
                                    <div className='min-w-[200px] flex-1 space-y-1.5'>
                                        <Label htmlFor='test-to'>
                                            Enviar prueba a
                                        </Label>
                                        <Input
                                            id='test-to'
                                            type='email'
                                            value={testTo}
                                            placeholder='tu@empresa.com'
                                            onChange={(event) =>
                                                setTestTo(event.target.value)
                                            }
                                        />
                                    </div>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        disabled={
                                            testMutation.isPending ||
                                            !testTo.trim() ||
                                            !smtpConfigured
                                        }
                                        onClick={sendTest}>
                                        {testMutation.isPending ? (
                                            <Loader2 className='animate-spin' />
                                        ) : (
                                            <TestTube2 />
                                        )}
                                        Enviar prueba
                                    </Button>
                                </div>

                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <p className='text-muted-foreground text-xs'>
                                        {selected.size === 0
                                            ? 'Selecciona destinatarios para enviar'
                                            : `${reachable} envíos${
                                                  excluded
                                                      ? ` · ${excluded} excluidos sin email`
                                                      : ''
                                              } · lotes de ${BATCH_SIZE}`}
                                    </p>
                                    <Button
                                        type='button'
                                        disabled={!canSend}
                                        onClick={() => sendMutation.mutate()}>
                                        {sendMutation.isPending ? (
                                            <Loader2 className='animate-spin' />
                                        ) : (
                                            <Send />
                                        )}
                                        Enviar a {reachable}
                                    </Button>
                                </div>

                                {progress && (
                                    <div className='space-y-1'>
                                        <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
                                            <div
                                                className='h-full bg-emerald-500 transition-all'
                                                style={{
                                                    width: `${Math.round(
                                                        ((progress.sent +
                                                            progress.failed +
                                                            progress.skipped) /
                                                            Math.max(
                                                                1,
                                                                progress.total
                                                            )) *
                                                            100
                                                    )}%`
                                                }}
                                            />
                                        </div>
                                        <p className='text-muted-foreground text-xs'>
                                            {progress.sent} enviados ·{' '}
                                            {progress.failed} fallidos ·{' '}
                                            {progress.skipped} excluidos ·{' '}
                                            {progress.pending} en cola
                                        </p>
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='sm'
                                            onClick={() => {
                                                abortRef.current = true
                                                toast.info(
                                                    'Envío pausado. Podés continuar luego desde el historial.'
                                                )
                                            }}>
                                            Pausar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Vista previa */}
                        <div className='space-y-2 lg:col-span-2'>
                            <div className='flex items-center gap-2'>
                                <Eye className='size-4' />
                                <h2 className='text-sm font-semibold'>
                                    3. Vista previa
                                </h2>
                                <span className='text-muted-foreground text-xs'>
                                    {preview.subject || subject}
                                </span>
                            </div>
                            <div className='overflow-hidden rounded-md border bg-white'>
                                <iframe
                                    title='Vista previa del correo'
                                    srcDoc={
                                        preview.html ||
                                        '<p style="font-family:sans-serif;color:#888;padding:24px">Escribe el mensaje para ver la vista previa.</p>'
                                    }
                                    className='h-[420px] w-full'
                                    sandbox=''
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}