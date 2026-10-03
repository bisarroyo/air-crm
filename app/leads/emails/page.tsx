'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { GlobeLoader } from '@/components/ui/globe-loader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmailsWorkspace } from '@/components/emails/emails-workspace'
import { useSession } from '@/hooks/use-session'

export default function Page() {
    return (
        <Suspense
            fallback={
                <GlobeLoader fullScreen={false} className='min-h-[70vh]' />
            }>
            <EmailsPage />
        </Suspense>
    )
}

function EmailsPage() {
    const { session, isPending } = useSession()

    if (isPending) {
        return <GlobeLoader fullScreen={false} className='min-h-[70vh]' />
    }

    if (!session) {
        return (
            <div className='container mx-auto p-6'>
                <p className='text-muted-foreground text-sm'>
                    Inicia sesión para enviar correos a tus clientes.
                </p>
                <Link href='/signin' className='mt-4 inline-block'>
                    <Button>Sign In</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className='container mx-auto p-6'>
            <Card>
                <CardHeader>
                    <CardTitle>Emails</CardTitle>
                    <p className='mt-0.5 text-sm text-muted-foreground'>
                        Campañas masivas con datos del CRM, copia oculta y
                        registro de cada envío.
                    </p>
                </CardHeader>
                <CardContent>
                    <EmailsWorkspace />
                </CardContent>
            </Card>
        </div>
    )
}