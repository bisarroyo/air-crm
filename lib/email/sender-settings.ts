import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { emailSenderSettings } from '@/db/schema'

export async function getEmailSenderSettings() {
    const [row] = await db.select().from(emailSenderSettings)
        .where(eq(emailSenderSettings.id, 1)).limit(1)
    return {
        fromName: row?.fromName || process.env.SMTP_FROM_NAME?.trim() ||
            process.env.SMTP_FROM_ADDRESS?.trim() || 'Notificaciones',
        fromAddress: process.env.SMTP_FROM_ADDRESS?.trim() || process.env.SMTP_USER?.trim() || ''
    }
}
