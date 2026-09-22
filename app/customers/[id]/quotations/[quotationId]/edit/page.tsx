import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { WizardPage } from '@/components/cotizaciones/wizard-page'
import { toDraft } from '@/lib/cotizaciones/shared'
import { parseQuotationData } from '@/lib/cotizaciones/quotation'
import { getCustomerDetail } from '@/lib/server-customer'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface PageProps {
    params: Promise<{ id: string; quotationId: string }>
}

export default async function QuotationEditPage({ params }: PageProps) {
    const { id, quotationId } = await params
    const customerId = Number(id)
    const qId = Number(quotationId)

    const headersList = await headers()
    const session = await auth.api.getSession({ headers: headersList })
    if (!session) {
        redirect('/signin')
    }

    const customer = await getCustomerDetail(customerId)
    if (!customer) {
        redirect('/leads')
    }

    const [quotation] = await db
        .select()
        .from(quotations)
        .where(eq(quotations.id, qId))
        .limit(1)

    if (!quotation) {
        redirect(`/customers/${customerId}`)
    }

    const data = parseQuotationData(quotation)
    const initialDraft = data ? toDraft(data) : undefined

    return (
        <WizardPage
            customerId={customerId}
            customer={customer}
            mode="edit"
            quotationId={qId}
            initialDraft={initialDraft}
        />
    )
}