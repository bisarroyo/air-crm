'use client'

import { Code2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { EmailEditor } from './email-editor'
import { TEMPLATE_VARIABLES } from '@/lib/email/template'
import { useInsertAtCursor } from '@/hooks/use-insert-at-cursor'

export type BodyMode = 'visual' | 'html'

/**
 * Editor del cuerpo del mensaje con los dos modos: visual (TipTap) o código
 * HTML directo. Se usa tanto al armar una campaña como al crear/editar una
 * plantilla guardada, para que el HTML que se escribe a mano sea exactamente el
 * que se envía.
 */
export function BodyEditor({
    mode,
    onModeChange,
    value,
    onChange,
    label = 'Contenido',
    rows = 14
}: {
    mode: BodyMode
    onModeChange: (mode: BodyMode) => void
    value: string
    onChange: (html: string) => void
    label?: string
    rows?: number
}) {
    // Las variables se insertan donde está el cursor, no al final del HTML.
    const html = useInsertAtCursor<HTMLTextAreaElement>()

    return (
        <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
                <Label>{label}</Label>
                <div className='flex gap-1'>
                    <Button
                        type='button'
                        variant={mode === 'visual' ? 'secondary' : 'ghost'}
                        size='sm'
                        onClick={() => onModeChange('visual')}>
                        <Pencil />
                        Visual
                    </Button>
                    <Button
                        type='button'
                        variant={mode === 'html' ? 'secondary' : 'ghost'}
                        size='sm'
                        onClick={() => onModeChange('html')}>
                        <Code2 />
                        Código HTML
                    </Button>
                </div>
            </div>

            {mode === 'visual' ? (
                <EmailEditor value={value} onChange={onChange} />
            ) : (
                <textarea
                    {...html.cursorProps}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    spellCheck={false}
                    rows={rows}
                    placeholder='<p>Hola <strong>{{nombre_primero}}</strong>,</p>'
                    className='w-full rounded-md border bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
                />
            )}

            {mode === 'html' && (
                <div className='text-muted-foreground rounded-md border p-3 text-xs'>
                    <p className='mb-1.5 font-medium text-foreground'>
                        Variables disponibles
                    </p>
                    <div className='flex flex-wrap gap-1'>
                        {TEMPLATE_VARIABLES.map((variable) => (
                            <button
                                key={variable.token}
                                type='button'
                                className='rounded bg-muted px-1.5 py-0.5 font-mono hover:bg-accent'
                                title={`${variable.label} · ej: ${variable.sample}`}
                                onClick={() =>
                                    html.insert(variable.token, value, onChange)
                                }>
                                {variable.token}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}