import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { QuotationPreviewPage } from '@/components/cotizaciones/preview-page'
import { parseQuotationData } from '@/lib/cotizaciones/quotation'
import { db } from '@/db'
import { quotations } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface PageProps {
    params: Promise<{ id: string; quotationId: string }>
}

export default async function QuotationViewPage({ params }: PageProps) {
    const { id, quotationId } = await params
    const customerId = Number(id)
    const qId = Number(quotationId)

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        redirect('/signin')
    }

    const [quotation] = await db
        .select()
        .from(quotations)
        .where(eq(quotations.id, qId))
        .limit(1)

    if (!quotation || quotation.customerId !== customerId) {
        notFound()
    }

    const data = parseQuotationData(quotation)
    if (!data) {
        notFound()
    }

    const canEdit =
        session.user.role === 'admin' || quotation.advisorId === session.user.id

    return (
        <QuotationPreviewPage
            customerId={customerId}
            quotationId={qId}
            number={quotation.number}
            status={quotation.status}
            data={data}
            advisorName={quotation.advisorName}
            canEdit={canEdit}
        />
    )
}