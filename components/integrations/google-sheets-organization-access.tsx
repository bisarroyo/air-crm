'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function GoogleSheetsOrganizationAccess({ organizations, activeOrganizationId }: {
    organizations: { id: string; name: string; role: string }[]
    activeOrganizationId: string | null
}) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [pendingId, setPendingId] = useState<string | null>(null)
    const active = organizations.find(org => org.id === activeOrganizationId)

    async function activate(organizationId: string) {
        setPendingId(organizationId)
        try {
            const result = await authClient.organization.setActive({ organizationId })
            if (result.error) throw new Error(result.error.message || 'No se pudo activar la organización.')
            // Cached CRM records from the prior organization must not remain visible.
            await queryClient.cancelQueries()
            queryClient.clear()
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo activar la organización.')
        } finally {
            setPendingId(null)
        }
    }

    return (
        <div className='container mx-auto max-w-2xl p-6'>
            <Card>
                <CardHeader>
                    <CardTitle>Google Sheets: acceso por organización</CardTitle>
                    <CardDescription>
                        {active
                            ? `Tu rol en ${active.name} no permite administrar esta integración.`
                            : 'Seleccioná una organización activa para configurar Google Sheets.'}
                        {' '}Necesitás ser propietario o administrador de esa organización.
                        El rol de administrador global del CRM no sustituye ese permiso.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {organizations.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            Tu cuenta no pertenece a ninguna organización. Un propietario debe
                            invitarte y asignarte el rol correspondiente antes de conectar la hoja.
                        </p>
                    ) : organizations.map(org => {
                        const canManage = org.role.split(',').some(role => ['owner', 'admin'].includes(role.trim()))
                        return (
                            <div key={org.id} className='flex items-center justify-between gap-4 rounded-md border p-3'>
                                <div>
                                    <p className='text-sm font-medium'>{org.name}</p>
                                    {!canManage && <p className='text-xs text-muted-foreground'>Sin permisos para administrar integraciones.</p>}
                                </div>
                                <Button disabled={!canManage || pendingId !== null} onClick={() => activate(org.id)}>
                                    {pendingId === org.id ? 'Activando…' : 'Usar organización'}
                                </Button>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    )
}
