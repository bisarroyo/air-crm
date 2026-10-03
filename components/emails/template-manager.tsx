'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Download,
    Loader2,
    Pencil,
    Plus,
    Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    EMPTY_TEMPLATE,
    TemplateForm,
    type TemplateDraft
} from './template-presets'
import {
    EMAIL_PRESETS,
    EMAIL_PRESET_CATEGORIES,
    type StoredEmailTemplate
} from '@/lib/email/presets'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const payload = await response.json()
    if (!response.ok) {
        throw new Error(payload.error || 'Error inesperado')
    }
    return payload as T
}

/** Pestaña "Plantillas": crear, editar, borrar e importar las de ejemplo. */
export function TemplateManager() {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState<TemplateDraft | null>(null)
    const [deleting, setDeleting] = useState<StoredEmailTemplate | null>(null)

    const templatesQuery = useQuery({
        queryKey: ['email-templates'],
        queryFn: () =>
            fetchJson<{ data: StoredEmailTemplate[] }>('/api/emails/templates')
    })

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['email-templates'] })

    const saveMutation = useMutation({
        mutationFn: (payload: TemplateDraft) =>
            fetchJson(
                payload.id
                    ? `/api/emails/templates/${payload.id}`
                    : '/api/emails/templates',
                {
                    method: payload.id ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            ),
        onSuccess: (_data, payload) => {
            toast.success(
                payload.id ? 'Plantilla actualizada' : 'Plantilla creada'
            )
            setDraft(null)
            void invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const importMutation = useMutation({
        mutationFn: () =>
            fetchJson<{ imported: number; total: number }>(
                '/api/emails/templates',
                { method: 'PUT' }
            ),
        onSuccess: ({ imported, total }) => {
            toast.success(
                imported > 0
                    ? `Se importaron ${imported} plantillas`
                    : 'Las plantillas de ejemplo ya estaban importadas',
                { description: `Ahora tenés ${total} plantillas.` }
            )
            void invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            fetchJson(`/api/emails/templates/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success('Plantilla eliminada')
            setDeleting(null)
            void invalidate()
        },
        onError: (error: Error) => {
            toast.error(error.message)
            setDeleting(null)
        }
    })

    const templates = templatesQuery.data?.data ?? []

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-muted-foreground text-sm'>
                    {templates.length} plantilla
                    {templates.length === 1 ? '' : 's'} guardada
                    {templates.length === 1 ? '' : 's'}, organizadas por
                    categoría para elegirlas rápido al enviar.
                </p>
                <div className='flex gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={importMutation.isPending}
                        onClick={() => importMutation.mutate()}>
                        {importMutation.isPending ? (
                            <Loader2 className='animate-spin' />
                        ) : (
                            <Download />
                        )}
                        Importar {EMAIL_PRESETS.length} ejemplos
                    </Button>
                    <Button
                        type='button'
                        onClick={() =>
                            setDraft({ ...EMPTY_TEMPLATE })
                        }>
                        <Plus />
                        Nueva plantilla
                    </Button>
                </div>
            </div>

            {draft && (
                <TemplateForm
                    draft={draft}
                    onChange={setDraft}
                    onSubmit={() => saveMutation.mutate(draft)}
                    onCancel={() => setDraft(null)}
                    isPending={saveMutation.isPending}
                    submitLabel={draft.id ? 'Guardar cambios' : 'Crear plantilla'}
                />
            )}

            {templatesQuery.isPending ? (
                <div className='text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm'>
                    <Loader2 className='animate-spin' />
                    Cargando plantillas…
                </div>
            ) : templates.length === 0 ? (
                <div className='text-muted-foreground space-y-2 rounded-md border border-dashed py-12 text-center text-sm'>
                    <p>No hay plantillas guardadas todavía.</p>
                    <p className='text-xs'>
                        Crea la primera con <strong>Nueva plantilla</strong> o
                        importá las {EMAIL_PRESETS.length} de ejemplo.
                    </p>
                </div>
            ) : (
                EMAIL_PRESET_CATEGORIES.map((category) => {
                    const group = templates.filter(
                        (template) => template.category === category
                    )
                    if (group.length === 0) return null

                    return (
                        <div key={category} className='space-y-1.5'>
                            <p className='text-muted-foreground text-xs font-medium uppercase tracking-wide'>
                                {category} · {group.length}
                            </p>
                            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                                {group.map((template) => (
                                    <div
                                        key={template.id}
                                        className='flex flex-col gap-1.5 rounded-md border p-2.5'>
                                        <div className='min-w-0 flex-1'>
                                            <p className='truncate text-sm font-medium'>
                                                {template.name}
                                            </p>
                                            {template.description && (
                                                <p className='text-muted-foreground text-xs'>
                                                    {template.description}
                                                </p>
                                            )}
                                            <p className='text-muted-foreground mt-1 truncate text-[11px]'>
                                                Asunto: {template.subject}
                                            </p>
                                        </div>
                                        <div className='flex justify-end gap-1'>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() =>
                                                    setDraft({
                                                        id: template.id,
                                                        name: template.name,
                                                        description:
                                                            template.description ||
                                                            '',
                                                        category:
                                                            template.category,
                                                        subject: template.subject,
                                                        bodyHtml:
                                                            template.bodyHtml
                                                    })
                                                }>
                                                <Pencil />
                                                Editar
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon-sm'
                                                title='Eliminar plantilla'
                                                onClick={() =>
                                                    setDeleting(template)
                                                }>
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })
            )}

            <Dialog
                open={deleting != null}
                onOpenChange={(open) => !open && setDeleting(null)}>
                <DialogContent className='max-w-sm'>
                    <DialogHeader>
                        <DialogTitle>Eliminar plantilla</DialogTitle>
                        <DialogDescription>
                            ¿Seguro que querés eliminar{' '}
                            <strong>{deleting?.name}</strong>? Esto no se puede
                            deshacer. Las campañas ya enviadas no cambian.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='flex justify-end gap-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => setDeleting(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                                deleting &&
                                deleteMutation.mutate(deleting.id)
                            }>
                            {deleteMutation.isPending ? (
                                <Loader2 className='animate-spin' />
                            ) : null}
                            Eliminar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}