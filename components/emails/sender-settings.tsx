'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Settings = { fromName: string; fromAddress: string; canEdit: boolean }

async function requestSettings(init?: RequestInit): Promise<Settings> {
    const response = await fetch('/api/emails/settings', init)
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) throw new Error(result?.error || 'No se pudo cargar la configuración')
    return result
}

export function SenderSettings() {
    const queryClient = useQueryClient()
    const query = useQuery({ queryKey: ['email-settings'], queryFn: () => requestSettings() })
    const [draft, setDraft] = useState<string | null>(null)
    const name = draft ?? query.data?.fromName ?? ''
    const save = useMutation({
        mutationFn: () => requestSettings({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromName: name.trim() })
        }),
        onSuccess: (settings) => {
            queryClient.setQueryData(['email-settings'], settings)
            setDraft(null)
            toast.success('Nombre del remitente guardado')
        },
        onError: (error: Error) => toast.error(error.message)
    })

    if (query.isPending) return <p role='status'>Cargando configuración…</p>
    if (query.isError) return (
        <div className='space-y-3'>
            <p role='alert'>{query.error.message}</p>
            <Button variant='outline' onClick={() => query.refetch()}>Reintentar</Button>
        </div>
    )

    return (
        <form className='max-w-xl space-y-5 rounded-lg border p-5' onSubmit={(event) => {
            event.preventDefault()
            if (query.data.canEdit && !save.isPending) save.mutate()
        }}>
            <div>
                <h2 className='font-semibold'>Remitente de los correos</h2>
                <p className='text-muted-foreground mt-1 text-sm'>
                    Este nombre aparecerá en los nuevos envíos de campañas, pruebas y cotizaciones de todo el equipo.
                </p>
            </div>
            <div className='space-y-2'>
                <Label htmlFor='sender-name'>Nombre del remitente</Label>
                <Input id='sender-name' value={name} onChange={(event) => setDraft(event.target.value)}
                    placeholder='Bismark Arroyo de S Travel' required maxLength={120}
                    disabled={!query.data.canEdit || save.isPending} />
            </div>
            <div className='space-y-2'>
                <Label htmlFor='sender-address'>Dirección de correo</Label>
                <Input id='sender-address' value={query.data.fromAddress} readOnly />
            </div>
            <div className='bg-muted/40 rounded-md p-3 text-sm'>
                <p className='text-muted-foreground mb-1'>Así lo verán los destinatarios</p>
                <p className='break-words'><strong>{name.trim() || 'Nombre del remitente'}</strong> &lt;{query.data.fromAddress || 'Sin dirección configurada'}&gt;</p>
            </div>
            {query.data.canEdit ? (
                <Button type='submit' disabled={save.isPending || !name.trim() || name.trim() === query.data.fromName}>
                    {save.isPending ? 'Guardando…' : 'Guardar configuración'}
                </Button>
            ) : <p className='text-muted-foreground text-sm'>Solo un administrador puede cambiar el remitente.</p>}
        </form>
    )
}
