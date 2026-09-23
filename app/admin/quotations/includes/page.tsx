'use client'

import { CatalogManager } from '@/components/admin-catalog/catalog-manager'
import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'

export default function SchoolIncludesPage() {
    return (
        <div className='container mx-auto space-y-6 p-6'>
            <div className='flex items-center gap-3'>
                <a
                    href='/admin/quotations'
                    className='text-sm text-muted-foreground hover:text-foreground'>
                    ← Cotizaciones
                </a>
            </div>
            <CatalogManager config={CATALOG_DEFS.schoolIncludes} />
        </div>
    )
}