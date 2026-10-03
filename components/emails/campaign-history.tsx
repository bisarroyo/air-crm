'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDateShort } from '@/lib/cotizaciones/shared'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Trash2 } from 'lucide-react'

type Campaign = {
    id: number
    name: string
    subject: string
    status: 'draft' | 'sending' | 'completed'
    bcc: string | null
    recipientCount: number
    sentCount: number
    failedCount: number
    skippedCount: number
    createdAt: Date | string | null
    completedAt: Date | string | null
}

type Recipient = {
    id: number
    name: string
    email: string | null
    status: 'pending' | 'sent' | 'failed' | 'skipped'
    error: string | null
    sentAt: Date | string | null
}

const STATUS_BADGE: Record<
    Campaign['status'],
    { label: string; className: string }
> = {
    draft: { label: 'Preparada', className: 'bg-muted text-muted-foreground' },
    sending: { label: 'Enviando', className: 'bg-blue-500/15 text-blue-600' },
    completed: {
        label: 'Completada',
        className: 'bg-emerald-500/15 text-emerald-600'
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const payload = await response.json()
    if (!response.ok) {
        throw new Error(payload.error || 'Error inesperado')
    }
    return payload as T
}

export function CampaignHistory({ onSelect }: { onSelect: () => void }) {
    const queryClient = useQueryClient()
    const [openId, setOpenId] = useState<number | null>(null)

    const campaignsQuery = useQuery({
        queryKey: ['email-campaigns'],
        queryFn: () =>
            fetchJson<{ data: Campaign[] }>('/api/emails/campaigns')
    })

    const detailQuery = useQuery({
        queryKey: ['email-campaigns', openId],
        queryFn: () =>
            fetchJson<{ campaign: Campaign; recipients: Recipient[] }>(
                `/api/emails/campaigns/${openId}`
            ),
        enabled: openId != null
    })

    const retryMutation = useMutation({
        mutationFn: (id: number) =>
            fetchJson(`/api/emails/campaigns/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'retry' })
            }),
        onSuccess: () => {
            toast.success('Los fallidos volvieron a la cola')
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
            onSelect()
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            fetchJson(`/api/emails/campaigns/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success('Campaña eliminada')
            setOpenId(null)
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const campaigns = campaignsQuery.data?.data ?? []
    const recipients = detailQuery.data?.recipients ?? []

    if (campaignsQuery.isPending) {
        return (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm'>
                <Loader2 className='animate-spin' />
                Cargando campañas…
            </div>
        )
    }

    if (campaigns.length === 0) {
        return (
            <div className='text-muted-foreground py-12 text-center text-sm'>
                Todavía no has enviado ninguna campaña
            </div>
        )
    }

    return (
        <>
            <div className='overflow-hidden rounded-md border'>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Campaña</TableHead>
                            <TableHead>Asunto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className='text-right'>
                                Enviados
                            </TableHead>
                            <TableHead className='text-right'>
                                Fallidos
                            </TableHead>
                            <TableHead className='text-right'>
                                Excluidos
                            </TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className='w-[130px]' />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {campaigns.map((campaign) => {
                            const badge = STATUS_BADGE[campaign.status]
                            return (
                                <TableRow key={campaign.id}>
                                    <TableCell className='font-medium'>
                                        {campaign.name}
                                    </TableCell>
                                    <TableCell className='text-muted-foreground max-w-[220px] truncate'>
                                        {campaign.subject}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        {campaign.sentCount} /{' '}
                                        {campaign.recipientCount}
                                    </TableCell>
                                    <TableCell className='text-destructive text-right'>
                                        {campaign.failedCount}
                                    </TableCell>
                                    <TableCell className='text-muted-foreground text-right'>
                                        {campaign.skippedCount}
                                    </TableCell>
                                    <TableCell className='text-muted-foreground text-xs'>
                                        {formatDateShort(campaign.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <div className='flex justify-end gap-1'>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() =>
                                                    setOpenId(campaign.id)
                                                }>
                                                Detalle
                                            </Button>
                                            {campaign.failedCount > 0 &&
                                                campaign.status !==
                                                    'sending' && (
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon-sm'
                                                        title='Reintentar fallidos'
                                                        onClick={() =>
                                                            retryMutation.mutate(
                                                                campaign.id
                                                            )
                                                        }>
                                                        <RotateCcw />
                                                    </Button>
                                                )}
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon-sm'
                                                title='Eliminar campaña'
                                                onClick={() =>
                                                    deleteMutation.mutate(
                                                        campaign.id
                                                    )
                                                }>
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={openId != null}
                onOpenChange={(open) => !open && setOpenId(null)}>
                <DialogContent className='max-h-[80vh] max-w-3xl overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {detailQuery.data?.campaign.name}
                        </DialogTitle>
                        <DialogDescription>
                            {detailQuery.data?.campaign.subject}
                        </DialogDescription>
                    </DialogHeader>

                    <div className='overflow-hidden rounded-md border'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Destinatario</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Resultado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recipients.map((recipient) => (
                                    <TableRow key={recipient.id}>
                                        <TableCell>
                                            {recipient.name}
                                        </TableCell>
                                        <TableCell className='text-muted-foreground'>
                                            {recipient.email || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <div className='flex items-center gap-1.5'>
                                                {recipient.status === 'sent' && (
                                                    <>
                                                        <CheckCircle2 className='size-3.5 text-emerald-600' />
                                                        <span className='text-xs'>
                                                            Enviado
                                                        </span>
                                                    </>
                                                )}
                                                {recipient.status ===
                                                    'failed' && (
                                                    <>
                                                        <AlertCircle className='size-3.5 text-destructive' />
                                                        <span
                                                            className='text-destructive text-xs'
                                                            title={
                                                                recipient.error ||
                                                                undefined
                                                            }>
                                                            Falló
                                                        </span>
                                                    </>
                                                )}
                                                {recipient.status ===
                                                    'skipped' && (
                                                    <span className='text-muted-foreground text-xs'>
                                                        Excluido
                                                    </span>
                                                )}
                                                {recipient.status ===
                                                    'pending' && (
                                                    <span className='text-muted-foreground text-xs'>
                                                            En cola
                                                    </span>
                                                )}
                                            </div>
                                            {recipient.error &&
                                                recipient.status !==
                                                    'pending' && (
                                                    <p className='text-muted-foreground mt-0.5 text-[11px]'>
                                                        {recipient.error}
                                                    </p>
                                                )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}