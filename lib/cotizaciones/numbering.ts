import { asc, like } from 'drizzle-orm'
import { quotations } from '@/db/schema'
import { db } from '@/db'
import { isCurrency, type Currency } from './shared'

function pad(n: number, width: number): string {
    return String(n).padStart(width, '0')
}

export async function nextQuotationNumber(now = new Date()): Promise<string> {
    const year = now.getFullYear()
    const prefix = `ST-${year}-`

    const rows = await db
        .select({ number: quotations.number })
        .from(quotations)
        .where(like(quotations.number, `${prefix}%`))
        .orderBy(asc(quotations.number))

    let max = 0
    for (const row of rows) {
        const suffix = row.number.slice(prefix.length)
        const parsed = Number.parseInt(suffix, 10)
        if (!Number.isNaN(parsed) && parsed > max) {
            max = parsed
        }
    }

    return `${prefix}${pad(max + 1, 4)}`
}

export function parseCurrency(value: string | null | undefined): Currency {
    return isCurrency(value) ? value : 'EUR'
}

export function currencyOr(value: unknown, fallback: Currency = 'EUR'): Currency {
    return isCurrency(String(value)) ? (value as Currency) : fallback
}