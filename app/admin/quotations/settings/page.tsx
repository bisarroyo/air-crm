'use client'

import { QuotationEmailSettingsManager } from '@/components/admin-catalog/quotation-email-settings'
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
            <QuotationEmailSettingsManager />
        </div>
    )
}