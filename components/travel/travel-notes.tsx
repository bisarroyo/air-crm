'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { useSession } from '@/hooks/use-session'

interface TravelNote {
    id: number
    note: string
    createdAt: string | null
    userId: string | null
    userName: string | null
    userEmail: string | null
}

function formatDate(value: string | null) {
    if (!value) return ''
    return new Date(value).toLocaleString('es', {
        dateStyle: 'short',
        timeStyle: 'short'
    })
}

export function TravelNotes({ leadId }: { leadId: number }) {
    const queryClient = useQueryClient()
    const { session } = useSession()
    const isAdmin = session?.user.role === 'admin'

    const [note, setNote] = useState('')

    const queryKey = ['travel-notes', leadId]

    const { data: notes = [], isLoading } = useQuery<TravelNote[]>({
        queryKey,
        queryFn: async () => {
            const res = await fetch(`/api/travel/leads/${leadId}/notes`)
            if (!res.ok) throw new Error('No se pudieron cargar las notas')
            return res.json()
        }
    })

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/travel/leads/${leadId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo guardar la nota')
            }
            return res.json()
        },
        onSuccess: () => {
            setNote('')
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const deleteMutation = useMutation({
        mutationFn: async (noteId: number) => {
            const res = await fetch(
                `/api/travel/leads/${leadId}/notes/${noteId}`,
                { method: 'DELETE' }
            )
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'No se pudo eliminar la nota')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Nota eliminada')
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error: Error) => toast.error(error.message)
    })

    const canDelete = (item: TravelNote) =>
        isAdmin || (session?.user?.id != null && item.userId === session.user.id)

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <StickyNote size={16} className='text-muted-foreground' />
                    Notas
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='flex flex-col gap-2'>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder='Escribí una nota sobre este lead...'
                        rows={3}
                        className='w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
                    />
                    <div className='flex justify-end'>
                        <Button
                            size='sm'
                            onClick={() => {
                                if (!note.trim()) {
                                    toast.error('Escribí una nota')
                                    return
                                }
                                createMutation.mutate()
                            }}
                            disabled={createMutation.isPending}>
                            {createMutation.isPending ? (
                                <Loader2 size={14} className='animate-spin' />
                            ) : (
                                'Agregar nota'
                            )}
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <GlobeLoader
                        fullScreen={false}
                        className='py-6'
                        size={80}
                        label='Cargando'
                    />
                ) : notes.length === 0 ? (
                    <p className='py-4 text-center text-sm text-muted-foreground'>
                        Sin notas todavía.
                    </p>
                ) : (
                    <div className='space-y-3'>
                        {notes.map((item) => (
                            <div
                                key={item.id}
                                className='rounded-lg border border-border/60 bg-muted/40 p-3 text-sm'>
                                <p className='whitespace-pre-wrap'>
                                    {item.note}
                                </p>
                                <div className='mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
                                    <span>
                                        {item.userName ||
                                            item.userEmail ||
                                            'Anónimo'}{' '}
                                        · {formatDate(item.createdAt)}
                                    </span>
                                    {canDelete(item) && (
                                        <Button
                                            variant='ghost'
                                            size='icon-xs'
                                            aria-label='Eliminar nota'
                                            onClick={() =>
                                                deleteMutation.mutate(item.id)
                                            }
                                            disabled={deleteMutation.isPending}>
                                            <Trash2 size={12} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
