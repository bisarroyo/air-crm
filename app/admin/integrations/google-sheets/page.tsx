import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

import { GoogleSheetsList } from '@/components/integrations/google-sheets-list'
import { googleSheetsPageAccess } from '@/lib/integrations/google-sheets-admin-page'

export default async function GoogleSheetsIntegrationsPage() {
    const access = await googleSheetsPageAccess()
    if ('denied' in access) return access.denied

    return (
        <div className='container mx-auto space-y-6 p-6'>
            <Link
                href='/admin'
                className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ChevronLeft className='size-4' />
                Administración
            </Link>
            <GoogleSheetsList
                key={access.organizationId}
                organizationId={access.organizationId}
            />
        </div>
    )
}
