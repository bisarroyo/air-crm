import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

import { GoogleSheetsDetail } from '@/components/integrations/google-sheets-detail'
import { googleSheetsPageAccess } from '@/lib/integrations/google-sheets-admin-page'

export default async function NewGoogleSheetsIntegrationPage() {
    const access = await googleSheetsPageAccess()
    if ('denied' in access) return access.denied

    return (
        <div className='container mx-auto space-y-6 p-6'>
            <Link
                href='/admin/integrations/google-sheets'
                className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ChevronLeft className='size-4' />
                Integraciones
            </Link>
            <GoogleSheetsDetail
                key={`new-${access.organizationId}`}
                organizationId={access.organizationId}
            />
        </div>
    )
}
