import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { WizardPage } from '@/components/cotizaciones/wizard-page'
import { snapshotCompany } from '@/lib/cotizaciones/quotation'
import { defaultDraft } from '@/lib/cotizaciones/shared'
import { getCustomerDetail } from '@/lib/server-customer'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function QuotationNewPage({ params }: PageProps) {
    const { id } = await params
    const customerId = Number(id)

    const headersList = await headers()
    const session = await auth.api.getSession({ headers: headersList })
    if (!session) {
        redirect('/signin')
    }

    const customer = await getCustomerDetail(customerId)
    if (!customer) {
        redirect('/leads')
    }

    const company = await snapshotCompany()
    const initialDraft = defaultDraft(
        { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', country: customer.country || '' },
        { name: company.advisorName, email: company.advisorEmail },
        company.currency
    )
    return <WizardPage customerId={customerId} customer={customer} mode="create" initialDraft={initialDraft} />
}