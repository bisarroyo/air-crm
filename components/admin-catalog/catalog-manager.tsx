'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { formatMoney, type Currency } from '@/lib/cotizaciones/shared'
import type { CatalogConfig, CatalogField } from '@/lib/cotizaciones/catalog-def'

type Row = Record<string, unknown>

function fieldToken(field: CatalogField): string {
    return `${field.key}:${field.type}:${field.optionsApi ?? ''}`
}

function DisplayValue({
    field,
    value,
    row
}: {
    field: CatalogField
    value: unknown
    row?: Row
}) {
    if (value === null || value === undefined || value === '') return '—'
    if (field.type === 'multi-select') {
        if (!Array.isArray(value) || value.length === 0) return '—'
        return `${value.length} escuela${value.length === 1 ? '' : 's'}`
    }
    if (field.format === 'euros' || field.format === 'cents') {
        const currency = (row?.currency as Currency) || 'EUR'
        if (field.key === 'value' && row?.type === 'percent') {
            return `${value}%`
        }
        return formatMoney(Number(value), currency)
    }
    if (field.format === 'number') {
        return String(value)
    }
    if (field.format === 'date') {
        return String(value).slice(0, 10)
    }
    if (typeof value === 'number') {
        return String(value)
    }
    const text = String(value)
    return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

export function CatalogManager({ config }: { config: CatalogConfig }) {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Row | null>(null)
    const [form, setForm] = useState<
        Record<string, string | number | boolean | number[]>
    >({})

    const { data: rows = [], isLoading } = useQuery<Row[]>({
        queryKey: ['catalog', config.entity],
        queryFn: async () => {
            const res = await fetch(`/api/admin/${config.entity}`)
            if (!res.ok) throw new Error('Error cargando datos')
            return res.json()
        }
    })

    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: ['catalog', config.entity]
        })

    function openCreate() {
        const next: Record<string, string | number | boolean | number[]> = {}
        for (const field of config.fields) {
            if (field.type === 'multi-select') {
                next[field.key] = []
            } else if (field.default !== undefined) {
                next[field.key] =
                    field.type === 'switch'
                        ? Boolean(field.default)
                        : String(field.default)
            } else if (field.type === 'switch') {
                next[field.key] = true
            }
        }
        setEditing(null)
        setForm(next)
        setDialogOpen(true)
    }

    function openEdit(row: Row) {
        const next: Record<string, string | number | boolean | number[]> = {}
        for (const field of config.fields) {
            const raw = row[field.key]
            if (field.type === 'multi-select') {
                next[field.key] = Array.isArray(raw)
                    ? raw.map(Number)
                    : []
            } else if (field.type === 'switch') {
                next[field.key] = raw === 1 || raw === true
            } else if (raw === null || raw === undefined) {
                next[field.key] = ''
            } else if (field.type === 'select') {
                next[field.key] = String(raw)
            } else {
                next[field.key] = raw as string | number
            }
        }
        setEditing(row)
        setForm(next)
        setDialogOpen(true)
    }

    const saveMutation = useMutation({
        mutationFn: async () => {
            const body: Record<string, unknown> = {}
            for (const field of config.fields) {
                const raw = form[field.key]
                if (field.type === 'switch') {
                    body[field.key] = raw ? 1 : 0
                } else if (field.type === 'multi-select') {
                    body[field.key] = Array.isArray(raw)
                        ? raw.map(Number)
                        : []
                } else if (field.type === 'number') {
                    body[field.key] =
                        raw === '' || raw === null || raw === undefined
                            ? null
                            : Number(raw)
                } else if (raw === '' || raw === undefined) {
                    body[field.key] = null
                } else {
                    body[field.key] = raw
                }
            }

            const required = config.fields.find((field) => {
                if (!field.required) return false
                const value = body[field.key]
                if (field.type === 'multi-select') {
                    return !Array.isArray(value) || value.length === 0
                }
                if (field.type === 'number') {
                    return (
                        value === null ||
                        value === undefined ||
                        value === '' ||
                        Number.isNaN(Number(value))
                    )
                }
                if (value === 0) return false
                return !value
            })
            if (required) {
                throw new Error(`${required.label} es requerido`)
            }

            const isEdit = editing !== null
            const url = isEdit
                ? `/api/admin/${config.entity}/${editing.id}`
                : `/api/admin/${config.entity}`
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const result = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(result?.error || 'No se pudo guardar')
            }
            return result
        },
        onSuccess: () => {
            toast.success(
                `${config.singular} ${editing ? 'actualizado' : 'creado'}`
            )
            setDialogOpen(false)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async (row: Row) => {
            const res = await fetch(
                `/api/admin/${config.entity}/${row.id}`,
                { method: 'DELETE' }
            )
            const result = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(result?.error || 'No se pudo eliminar')
            }
            return result
        },
        onSuccess: () => {
            toast.success(`${config.singular} eliminado`)
            invalidate()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const tableFields = config.fields.filter((field) => field.showInTable)

    return (
        <Card>
            <CardHeader className='flex-row items-center justify-between'>
                <CardTitle>{config.title}</CardTitle>
                <Button size='sm' onClick={openCreate}>
                    <Plus className='mr-2 size-4' />
                    Nuevo {config.singular.toLowerCase()}
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <GlobeLoader
                        fullScreen={false}
                        className='py-10'
                        size={100}
                    />
                ) : rows.length === 0 ? (
                    <p className='py-6 text-center text-sm text-muted-foreground'>
                        No hay registros todavía.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                {tableFields.map((field) => (
                                    <TableHead key={field.key}>
                                        {field.label}
                                    </TableHead>
                                ))}
                                <TableHead>Estado</TableHead>
                                <TableHead className='text-right'>
                                    Acciones
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={Number(row.id)}>
                                    <TableCell className='text-muted-foreground'>
                                        {String(row.id)}
                                    </TableCell>
                                    {tableFields.map((field) => (
                                        <TableCell key={field.key}>
                                            <DisplayValue
                                                field={field}
                                                value={row[field.key]}
                                                row={row}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <span
                                            className={cn(
                                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                                row.isActive === 1
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-500'
                                            )}>
                                            {row.isActive === 1
                                                ? 'Activo'
                                                : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className='flex items-center justify-end gap-1'>
                                            <Button
                                                variant='ghost'
                                                size='icon-xs'
                                                title='Editar'
                                                onClick={() => openEdit(row)}>
                                                <Pencil size={14} />
                                            </Button>
                                            <Button
                                                variant='ghost'
                                                size='icon-xs'
                                                className='text-destructive'
                                                title='Eliminar'
                                                onClick={() =>
                                                    deleteMutation.mutate(row)
                                                }>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {editing
                                ? `Editar ${config.singular.toLowerCase()}`
                                : `Nuevo ${config.singular.toLowerCase()}`}
                        </DialogTitle>
                        <DialogDescription>
                            Los cambios no afectan a las cotizaciones ya
                            creadas (guardan una copia).
                        </DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        {config.fields.map((field) => (
                            <CatalogFieldControl
                                key={fieldToken(field)}
                                field={field}
                                value={form[field.key]}
                                onChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        [field.key]: value
                                    }))
                                }
                            />
                        ))}
                    </div>
                    <div className='mt-6 flex justify-end gap-2'>
                        <Button
                            variant='ghost'
                            type='button'
                            onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type='button'
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}>
                            {saveMutation.isPending && (
                                <Loader2 className='mr-2 size-4 animate-spin' />
                            )}
                            Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function CatalogFieldControl({
    field,
    value,
    onChange
}: {
    field: CatalogField
    value: string | number | boolean | number[] | undefined
    onChange: (value: string | number | boolean | number[]) => void
}) {
    const { data: options = [] } = useQuery<Array<{ id: number; name: string }>>(
        {
            queryKey: ['catalog-options', field.optionsApi],
            queryFn: async () => {
                const res = await fetch(`/api/${field.optionsApi}`)
                if (!res.ok) throw new Error('Error cargando opciones')
                return res.json()
            },
            enabled: Boolean(field.optionsApi)
        }
    )

    let control: React.ReactNode
    switch (field.type) {
        case 'textarea':
            control = (
                <textarea
                    rows={3}
                    className='flex min-h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder}
                />
            )
            break
        case 'number':
            control = (
                <Input
                    type='number'
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={value === undefined || value === '' ? '' : String(value)}
                    onChange={(event) =>
                        onChange(event.target.value === '' ? '' : Number(event.target.value))
                    }
                    placeholder={field.placeholder}
                />
            )
            break
        case 'switch':
            control = (
                <div className='flex h-9 items-center'>
                    <Checkbox
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => onChange(!!checked)}
                    />
                </div>
            )
            break
        case 'select': {
            const hasDynamicOptions = Boolean(field.optionsApi)
            const staticOptions = field.options ?? []
            const selectItems: Array<{ value: string; label: string }> =
                hasDynamicOptions
                    ? options.map((option) => ({
                          value: String(option.id),
                          label: String(
                              option[
                                  (field.optionLabelKey ??
                                      'name') as keyof typeof option
                              ] ?? option.name
                          )
                      }))
                    : staticOptions.map((option) => ({
                          value: option.value,
                          label: option.label
                      }))
            control = (
                <Select
                    value={value === undefined ? '' : String(value)}
                    onValueChange={(next) => onChange(next ?? '')}
                    items={selectItems}>
                    <SelectTrigger aria-label={field.label}>
                        <SelectValue placeholder='Seleccionar' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {hasDynamicOptions
                                ? options.map((option) => (
                                      <SelectItem
                                          key={option.id}
                                          value={String(option.id)}>
                                          {String(
                                              option[
                                                  (field.optionLabelKey ??
                                                      'name') as keyof typeof option
                                              ] ?? option.name
                                          )}
                                      </SelectItem>
                                  ))
                                : staticOptions.map((option) => (
                                      <SelectItem
                                          key={option.value}
                                          value={option.value}>
                                          {option.label}
                                      </SelectItem>
                                  ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            )
            break
        }
        case 'multi-select': {
            const selected = Array.isArray(value) ? value : []
            control = (
                <div className='max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-input p-2'>
                    {options.length === 0 && (
                        <p className='text-xs text-muted-foreground'>
                            No hay opciones disponibles.
                        </p>
                    )}
                    {options.map((option) => {
                        const id = Number(option.id)
                        const checked = selected.includes(id)
                        return (
                            <label
                                key={option.id}
                                className='flex cursor-pointer items-center gap-2 text-sm'>
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(next) => {
                                        onChange(
                                            next
                                                ? [...selected, id]
                                                : selected.filter(
                                                      (value) => value !== id
                                                  )
                                        )
                                    }}
                                />
                                <span>{String(option.name)}</span>
                            </label>
                        )
                    })}
                </div>
            )
            break
        }
        case 'date':
            control = (
                <Input
                    type='date'
                    value={value === undefined ? '' : String(value).slice(0, 10)}
                    onChange={(event) => onChange(event.target.value)}
                />
            )
            break
        case 'image':
            control = (
                <Input
                    type='file'
                    accept='image/*'
                    onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => onChange(String(reader.result))
                        reader.readAsDataURL(file)
                    }}
                />
            )
            break
        default:
            control = (
                <Input
                    value={value === undefined ? '' : String(value)}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder}
                />
            )
    }

    return (
        <Field
            className={
                field.type === 'textarea' || field.type === 'multi-select'
                    ? 'sm:col-span-2'
                    : ''
            }>
            <FieldLabel>
                {field.label}
                {field.required && ' *'}
            </FieldLabel>
            {control}
            {field.helper && (
                <p className='text-xs text-muted-foreground'>{field.helper}</p>
            )}
        </Field>
    )
}

export function formatCents(value: number, currency?: string): string {
    return formatMoney(value, (currency as Currency) ?? 'EUR')
}