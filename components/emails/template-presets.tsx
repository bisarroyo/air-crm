'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileText, Info, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { BodyEditor, type BodyMode } from './body-editor'
import { useInsertAtCursor } from '@/hooks/use-insert-at-cursor'
import { TEMPLATE_VARIABLES } from '@/lib/email/template'
import {
    EMAIL_PRESET_CATEGORIES,
    EMAIL_PRESETS,
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

/**
 * Selector de plantillas dentro de la pestaña "Nuevo envío". Lee de la base de
 * datos y las agrupa por categoría para encontrarlas rápido.
 */
export function TemplatePresets({
    onApply
}: {
    onApply: (preset: StoredEmailTemplate) => void
}) {
    const [open, setOpen] = useState(false)

    const templatesQuery = useQuery({
        queryKey: ['email-templates'],
        queryFn: () =>
            fetchJson<{ data: StoredEmailTemplate[] }>('/api/emails/templates')
    })

    const templates = templatesQuery.data?.data ?? []

    return (
        <div className='rounded-md border'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='hover:bg-muted/40 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors'>
                <Sparkles className='size-4 shrink-0 text-amber-500' />
                <span className='flex-1 text-sm font-medium'>
                    Plantillas
                </span>
                {templatesQuery.isPending ? (
                    <Loader2 className='text-muted-foreground size-3.5 animate-spin' />
                ) : (
                    <span className='text-muted-foreground text-xs'>
                        {templates.length} guardadas
                    </span>
                )}
                <ChevronDown
                    className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {open && (
                <div className='space-y-3 border-t p-3'>
                    {templatesQuery.isPending ? (
                        <div className='text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm'>
                            <Loader2 className='animate-spin' />
                            Cargando plantillas…
                        </div>
                    ) : templates.length === 0 ? (
                        <div className='text-muted-foreground space-y-2 py-4 text-center text-sm'>
                            <p>Todavía no hay plantillas guardadas.</p>
                            <p className='text-xs'>
                                Crealas en la pestaña{' '}
                                <strong>Plantillas</strong> o importá las{' '}
                                {EMAIL_PRESETS.length} de ejemplo.
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
                                        {category}
                                    </p>
                                    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                                        {group.map((template) => (
                                            <div
                                                key={template.id}
                                                className='bg-muted/20 flex flex-col gap-1 rounded-md border p-2.5'>
                                                <div className='flex items-start gap-2'>
                                                    <FileText className='text-muted-foreground mt-0.5 size-3.5 shrink-0' />
                                                    <div className='min-w-0 flex-1'>
                                                        <p className='truncate text-sm font-medium'>
                                                            {template.name}
                                                        </p>
                                                        {template.description && (
                                                            <p className='text-muted-foreground text-xs'>
                                                                {
                                                                    template.description
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className='text-muted-foreground truncate text-[11px]'>
                                                    Asunto:{' '}
                                                    {template.subject}
                                                </p>
                                                <div className='flex justify-end'>
                                                    <Button
                                                        type='button'
                                                        size='sm'
                                                        variant='outline'
                                                        onClick={() =>
                                                            onApply(template)
                                                        }>
                                                        Usar
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })
                    )}

                    <p className='text-muted-foreground flex items-start gap-1.5 text-xs'>
                        <Info className='mt-0.5 size-3 shrink-0' />
                        Aplicar una plantilla reemplaza el asunto y el mensaje
                        actuales. Los destinatarios y la copia oculta no cambian.
                    </p>
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Formulario de creación / edición                                     */
/* ------------------------------------------------------------------ */

export type TemplateDraft = {
    id?: number
    name: string
    description: string
    category: StoredEmailTemplate['category']
    subject: string
    bodyHtml: string
}

export const EMPTY_TEMPLATE: TemplateDraft = {
    name: '',
    description: '',
    category: 'Seguimiento',
    subject: '',
    bodyHtml: '<p>Hola <strong>{{nombre_primero}}</strong>,</p><p>Escribí tu mensaje acá.</p>'
}

/**
 * Formulario reutilizado por la pestaña de plantillas: crea una plantilla
 * nueva o guarda los cambios de una existente.
 */
export function TemplateForm({
    draft,
    onChange,
    onSubmit,
    onCancel,
    isPending,
    submitLabel
}: {
    draft: TemplateDraft
    onChange: (draft: TemplateDraft) => void
    onSubmit: () => void
    onCancel: () => void
    isPending: boolean
    submitLabel: string
}) {
    // El HTML se puede escribir a mano o armar en el editor visual. El cuerpo se
    // guarda igual en los dos casos: es el mismo HTML.
    const [mode, setMode] = useState<BodyMode>('visual')
    // Las variables del asunto se insertan donde está el cursor.
    const subjectField = useInsertAtCursor<HTMLInputElement>()

    return (
        <div className='space-y-3 rounded-md border p-3'>
            <div className='grid gap-3 sm:grid-cols-[1fr_200px]'>
                <div className='space-y-1.5'>
                    <label
                        htmlFor='template-name'
                        className='text-sm font-medium'>
                        Nombre
                    </label>
                    <Input
                        id='template-name'
                        value={draft.name}
                        placeholder='Ej: Promo setiembre'
                        onChange={(event) =>
                            onChange({ ...draft, name: event.target.value })
                        }
                    />
                </div>

                <div className='space-y-1.5'>
                    <label
                        htmlFor='template-category'
                        className='text-sm font-medium'>
                        Categoría
                    </label>
                    <Select
                        value={draft.category}
                        onValueChange={(value) =>
                            onChange({
                                ...draft,
                                category: (value ||
                                    'Seguimiento') as TemplateDraft['category']
                            })
                        }>
                        <SelectTrigger
                            id='template-category'
                            className='w-full'>
                            <SelectValue placeholder='Categoría'>
                                {draft.category}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {EMAIL_PRESET_CATEGORIES.map((category) => (
                                <SelectItem
                                    key={category}
                                    value={category}>
                                    {category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className='space-y-1.5'>
                <label
                    htmlFor='template-description'
                    className='text-sm font-medium'>
                    Descripción
                </label>
                <Input
                    id='template-description'
                    value={draft.description}
                    placeholder='Para qué sirve, en una línea'
                    onChange={(event) =>
                        onChange({
                            ...draft,
                            description: event.target.value
                        })
                    }
                />
            </div>

            <div className='space-y-1.5'>
                <label
                    htmlFor='template-subject'
                    className='text-sm font-medium'>
                    Asunto
                </label>
                <div className='flex gap-1.5'>
                    <Input
                        {...subjectField.cursorProps}
                        id='template-subject'
                        value={draft.subject}
                        placeholder='Hola {{nombre_primero}}, ...'
                        onChange={(event) =>
                            onChange({
                                ...draft,
                                subject: event.target.value
                            })
                        }
                    />
                    <Select
                        value={null}
                        onValueChange={(token) => {
                            if (token)
                                subjectField.insert(
                                    ` ${token}`,
                                    draft.subject,
                                    (subject) => onChange({ ...draft, subject })
                                )
                        }}>
                        <SelectTrigger className='w-[140px] shrink-0'>
                            <SelectValue>Variable</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {(['Cliente', 'CRM'] as const).map((group) => (
                                <SelectGroupWrapper key={group} group={group} />
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <BodyEditor
                mode={mode}
                onModeChange={setMode}
                value={draft.bodyHtml}
                onChange={(bodyHtml) => onChange({ ...draft, bodyHtml })}
                label='Mensaje'
            />

            <div className='flex justify-end gap-2'>
                <Button
                    type='button'
                    variant='ghost'
                    onClick={onCancel}>
                    Cancelar
                </Button>
                <Button
                    type='button'
                    disabled={
                        isPending ||
                        !draft.name.trim() ||
                        !draft.subject.trim() ||
                        !draft.bodyHtml.trim()
                    }
                    onClick={onSubmit}>
                    {isPending ? (
                        <Loader2 className='animate-spin' />
                    ) : null}
                    {submitLabel}
                </Button>
            </div>
        </div>
    )
}

function SelectGroupWrapper({ group }: { group: 'Cliente' | 'CRM' }) {
    return (
        <SelectGroup>
            <SelectLabel>{group}</SelectLabel>
            {TEMPLATE_VARIABLES.filter(
                (variable) => variable.group === group
            ).map((variable) => (
                <SelectItem key={variable.token} value={variable.token}>
                    {variable.token}
                </SelectItem>
            ))}
        </SelectGroup>
    )
}