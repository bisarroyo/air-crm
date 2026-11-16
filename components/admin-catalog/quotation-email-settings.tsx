'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Save, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    QUOTATION_EMAIL_VARIABLES,
    validateEmailSettings,
    type QuotationEmailSettings,
    type QuotationEmailTemplate
} from '@/lib/cotizaciones/email'

export function QuotationEmailSettingsManager() {
    const queryClient = useQueryClient()
    const query = useQuery<QuotationEmailSettings>({
        queryKey: ['quotation-email-settings'],
        queryFn: async () => {
            const response = await fetch('/api/admin/quotation-email-settings')
            if (!response.ok)
                throw new Error('No se pudieron cargar los ajustes de email')
            return response.json()
        }
    })
    const [form, setForm] = useState<QuotationEmailSettings | null>(null)
    const [saving, setSaving] = useState(false)
    const value = form ?? query.data
    function editTemplate(id: string, patch: Partial<QuotationEmailTemplate>) {
        setForm((previous) => {
            const current = previous ?? query.data!
            return {
                ...current,
                templates: current.templates.map((template) =>
                    template.id === id ? { ...template, ...patch } : template
                )
            }
        })
    }
    async function save() {
        if (!value || saving) return
        const error = validateEmailSettings(value)
        if (error) {
            toast.error(error)
            return
        }
        setSaving(true)
        try {
            const response = await fetch('/api/admin/quotation-email-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(value)
            })
            const body = await response.json()
            if (!response.ok)
                throw new Error(body.error || 'No se pudieron guardar los ajustes')
            queryClient.setQueryData(['quotation-email-settings'], body)
            setForm(null)
            toast.success('Ajustes de email guardados')
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Error guardando ajustes'
            )
        } finally {
            setSaving(false)
        }
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes de email de cotizaciones</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Configura la copia a la empresa y los mensajes disponibles al enviar
                    una cotización.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {query.isPending && <p>Cargando ajustes de email…</p>}
                {query.isError && (
                    <div role="alert">
                        <p>No se pudieron cargar los ajustes de email.</p>
                        <Button variant="outline" onClick={() => query.refetch()}>
                            Reintentar
                        </Button>
                    </div>
                )}
                {value && (
                    <fieldset disabled={saving} className="space-y-5">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={value.copyCompany}
                                onCheckedChange={(checked) =>
                                    setForm({ ...value, copyCompany: checked === true })
                                }
                            />
                            Enviar copia a la empresa por defecto
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Se utiliza el email de empresa de la configuración superior.
                            Podrás desmarcar la copia en cada envío.
                        </p>
                        <div>
                            <label
                                htmlFor="default-quotation-email-template"
                                className="text-sm font-medium"
                            >
                                Mensaje predeterminado
                            </label>
                            <select
                                id="default-quotation-email-template"
                                value={value.defaultTemplateId ?? ''}
                                className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                                onChange={(event) =>
                                    setForm({
                                        ...value,
                                        defaultTemplateId: event.target.value || null
                                    })
                                }
                            >
                                <option value="">Primera plantilla disponible</option>
                                {value.templates.map((template) => (
                                    <option value={template.id} key={template.id}>
                                        {template.name || 'Sin nombre'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Variables disponibles:{' '}
                            {QUOTATION_EMAIL_VARIABLES.map(
                                (variable) => `{{${variable}}}`
                            ).join(', ')}
                            . Se completan con los datos de cada cotización. La firma del
                            asesor y la empresa se añade automáticamente.
                        </p>
                        {value.templates.length === 0 && (
                            <p className="rounded-md bg-muted p-3 text-sm">
                                No hay plantillas guardadas. El usuario podrá redactar un
                                mensaje personalizado antes de enviar.
                            </p>
                        )}
                        {value.templates.map((template) => (
                            <div
                                key={template.id}
                                className="space-y-3 rounded-lg border p-4"
                            >
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <label
                                            htmlFor={`template-name-${template.id}`}
                                            className="text-sm font-medium"
                                        >
                                            Nombre de plantilla
                                        </label>
                                        <Input
                                            id={`template-name-${template.id}`}
                                            maxLength={100}
                                            value={template.name}
                                            onChange={(event) =>
                                                editTemplate(template.id, {
                                                    name: event.target.value
                                                })
                                            }
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        aria-label={`Eliminar plantilla ${template.name}`}
                                        onClick={() =>
                                            setForm({
                                                ...value,
                                                templates: value.templates.filter(
                                                    (item) => item.id !== template.id
                                                ),
                                                defaultTemplateId:
                                                    value.defaultTemplateId ===
                                                    template.id
                                                        ? null
                                                        : value.defaultTemplateId
                                            })
                                        }
                                    >
                                        <Trash2 className="mr-2 size-4" />
                                        Eliminar
                                    </Button>
                                </div>
                                <div>
                                    <label
                                        htmlFor={`template-subject-${template.id}`}
                                        className="text-sm font-medium"
                                    >
                                        Asunto
                                    </label>
                                    <Input
                                        id={`template-subject-${template.id}`}
                                        maxLength={200}
                                        value={template.subject}
                                        onChange={(event) =>
                                            editTemplate(template.id, {
                                                subject: event.target.value
                                            })
                                        }
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor={`template-message-${template.id}`}
                                        className="text-sm font-medium"
                                    >
                                        Mensaje
                                    </label>
                                    <textarea
                                        id={`template-message-${template.id}`}
                                        rows={8}
                                        maxLength={12000}
                                        className="w-full rounded-md border bg-background p-3 text-sm"
                                        value={template.message}
                                        onChange={(event) =>
                                            editTemplate(template.id, {
                                                message: event.target.value
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="flex flex-wrap justify-between gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={value.templates.length >= 30}
                                onClick={() =>
                                    setForm({
                                        ...value,
                                        templates: [
                                            ...value.templates,
                                            {
                                                id: crypto.randomUUID(),
                                                name: 'Nueva plantilla',
                                                subject:
                                                    'Cotización {{numero}} — {{programa}}',
                                                message:
                                                    'Estimado/a {{cliente}}:\n\nAdjuntamos la cotización del programa {{programa}}. Quedamos a su disposición para atender sus consultas.\n\nAtentamente,'
                                            }
                                        ]
                                    })
                                }
                            >
                                <Plus className="mr-2 size-4" />
                                Añadir plantilla
                            </Button>
                            <Button type="button" onClick={save}>
                                {saving ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 size-4" />
                                )}
                                Guardar ajustes de email
                            </Button>
                        </div>
                    </fieldset>
                )}
            </CardContent>
        </Card>
    )
}
