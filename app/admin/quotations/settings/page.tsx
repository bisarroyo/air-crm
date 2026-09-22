'use client'

import { CompanySettingsManager } from '@/components/admin-catalog/company-settings'

export default function QuotationSettingsPage() {
    return (
        <div className='container mx-auto space-y-6 p-6'>
            <div className='flex items-center gap-3'>
                <a
                    href='/admin/quotations'
                    className='text-sm text-muted-foreground hover:text-foreground'>
                    ← Cotizaciones
                </a>
            </div>
            <CompanySettingsManager />
        </div>
    )
}