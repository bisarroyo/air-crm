import { and, eq, inArray, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/auth-schema'
import {
    customers,
    customerTags,
    tags,
    status,
    priority,
    quotations
} from '@/db/schema'
import { isValidEmail } from './template'
import type { RecipientContext } from './variables'

/**
 * Reexportado desde `constants.ts` para que los componentes cliente-usen el
 * mismo tope sin importar este módulo (que depende de `@/db`).
 */
export { CAMPAIGN_MAX_RECIPIENTS } from './constants'

export type LoadedRecipient = {
    customerId: number
    email: string | null
    name: string
    /** Motivo por el que el cliente no puede recibir el correo, si aplica. */
    skipReason: string | null
    context: RecipientContext
}

/**
 * Carga los clientes indicados con todos los datos que necesitan las variables
 * del correo. Los que no tienen email válido se devuelven igual, marcados con
 * `skipReason`, para que la interfaz pueda informar cuántos se excluyeron.
 *
 * `ownerId` limita a los clientes asignados a ese asesor (los admin pasan null
 * y pueden elegir cualquier cliente).
 */
export async function loadRecipients(
    customerIds: number[],
    ownerId: string | null
): Promise<LoadedRecipient[]> {
    const uniqueIds = [...new Set(customerIds.filter(Number.isInteger))]
    if (uniqueIds.length === 0) return []

    const conditions = [inArray(customers.id, uniqueIds)]
    if (ownerId) {
        conditions.push(eq(customers.assignedTo, ownerId))
    }

    const rows = await db
        .select({
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            country: customers.country,
            statusName: status.status,
            priorityName: priority.priority,
            advisorName: user.name
        })
        .from(customers)
        .leftJoin(status, eq(customers.statusId, status.id))
        .leftJoin(priority, eq(customers.priorityId, priority.id))
        .leftJoin(user, eq(customers.assignedTo, user.id))
        .where(and(...conditions))

    if (rows.length === 0) return []

    const rowIds = rows.map((row) => row.id)

    const tagRows = await db
        .select({
            customerId: customerTags.customerId,
            name: tags.tag
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(inArray(customerTags.customerId, rowIds))

    const tagsByCustomer = new Map<number, string[]>()
    for (const tagRow of tagRows) {
        const list = tagsByCustomer.get(tagRow.customerId) || []
        list.push(tagRow.name)
        tagsByCustomer.set(tagRow.customerId, list)
    }

    // Última cotización de cada cliente (la más reciente por fecha de creación).
    const lastQuotationRows = await db
        .select({
            customerId: quotations.customerId,
            number: quotations.number,
            totalCents: quotations.totalCents,
            currency: quotations.currency
        })
        .from(quotations)
        .where(inArray(quotations.customerId, rowIds))
        .orderBy(desc(quotations.createdAt))

    const lastQuotationByCustomer = new Map<
        number,
        { number: string; total: number | null; currency: string | null }
    >()
    for (const row of lastQuotationRows) {
        if (lastQuotationByCustomer.has(row.customerId)) continue
        lastQuotationByCustomer.set(row.customerId, {
            number: row.number,
            total:
                row.totalCents != null ? row.totalCents / 100 : null,
            currency: row.currency
        })
    }

    return rows.map((row) => {
        const email = (row.email || '').trim()
        const skipReason = email
            ? isValidEmail(email)
                ? null
                : `Email inválido: ${email}`
            : 'El cliente no tiene email'

        const lastQuotation = lastQuotationByCustomer.get(row.id)

        return {
            customerId: row.id,
            email: email || null,
            name: row.name,
            skipReason,
            context: {
                name: row.name,
                email: email || null,
                phone: row.phone,
                country: row.country,
                statusName: row.statusName,
                priorityName: row.priorityName,
                tags: tagsByCustomer.get(row.id) || [],
                advisorName: row.advisorName,
                lastQuotationNumber: lastQuotation?.number ?? null,
                lastQuotationTotal: lastQuotation?.total ?? null,
                lastQuotationCurrency:
                    (lastQuotation?.currency as RecipientContext['lastQuotationCurrency']) ??
                    null
            }
        }
    })
}

/** Cuenta cuántos clientes de la selección no tienen email válido. */
export function countSkipped(recipients: LoadedRecipient[]): number {
    return recipients.filter((recipient) => recipient.skipReason).length
}

/** Consulta de apoyo para la interfaz:.total de clientes que tienen email. */
export async function countReachableCustomers(
    ownerId: string | null
): Promise<number> {
    const conditions = [
        sql`${customers.email} is not null`,
        sql`trim(${customers.email}) <> ''`
    ]
    if (ownerId) conditions.push(eq(customers.assignedTo, ownerId))

    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(...conditions))

    return Number(result?.count ?? 0)
}