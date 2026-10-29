import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GoogleSheetsDetail } from '@/components/integrations/google-sheets-detail'
import { googleSheetsPageAccess } from '@/lib/integrations/google-sheets-admin-page'

export default async function GoogleSheetsIntegrationDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const access = await googleSheetsPageAccess()
    if ('denied' in access) return access.denied

    const { id } = await params
    const integrationId = Number(id)
    if (!Number.isSafeInteger(integrationId) || integrationId <= 0) {
        notFound()
    }

    return (
        <div className='container mx-auto space-y-6 p-6'>
            <Link
                href='/admin/integrations/google-sheets'
                className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ChevronLeft className='size-4' />
                Integraciones
            </Link>
            <GoogleSheetsDetail
                key={`${access.organizationId}-${integrationId}`}
                organizationId={access.organizationId}
                integrationId={integrationId}
            />
        </div>
    )
}
