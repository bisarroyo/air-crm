import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { quotationEmailSettings } from '@/db/schema'
import { DEFAULT_QUOTATION_EMAIL_SETTINGS, type QuotationEmailSettings } from './email'

export async function getQuotationEmailSettings(): Promise<QuotationEmailSettings> {
    const [row] = await db
        .select()
        .from(quotationEmailSettings)
        .where(eq(quotationEmailSettings.id, 1))
        .limit(1)
    if (!row) return structuredClone(DEFAULT_QUOTATION_EMAIL_SETTINGS)
    return {
        copyCompany: row.copyCompany,
        defaultTemplateId: row.defaultTemplateId,
        templates: JSON.parse(row.templates)
    }
}
