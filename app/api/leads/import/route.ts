import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { customers, logs, customerTags } from '@/db/schema'
import {
    buildImportContext,
    parseImportRows,
    validateImportRow
} from '@/lib/leads-import-validate'
import type { NormalizedLeadRow } from '@/lib/leads-import'
import { getTagNamesByIds, resolveExistingTagIds } from '@/lib/tags'

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const leads = parseImportRows(body || {})

    if (!leads) {
        return NextResponse.json(
            { error: 'A leads array (1 to 500 rows) is required' },
            { status: 400 }
        )
    }

    const batchTagIds = await resolveExistingTagIds(body?.tagIds)
    const batchTagNames = batchTagIds.length
        ? [...(await getTagNamesByIds(batchTagIds)).values()]
        : []

    const ctx = await buildImportContext(
        session.user.id,
        session.user.role
    )

    const seenEmails = new Map<string, number>()
    const validRows: NormalizedLeadRow[] = []
    const outcomes: {
        index: number
        row: number
        status: 'imported' | 'skipped'
        reason?: string
    }[] = []

    for (let i = 0; i < leads.length; i++) {
        const result = validateImportRow(leads[i], ctx, i + 1)
        const lead = result.lead

        if (lead) {
            const email = lead.email
            if (ctx.existingEmails.has(email)) {
                result.errors.push(
                    'A customer with this email already exists'
                )
            }
            const firstRow = seenEmails.get(email)
            if (firstRow !== undefined) {
                result.errors.push(
                    `Duplicate email within the file (row ${firstRow})`
                )
            } else {
                seenEmails.set(email, lead.row)
            }
            result.valid = result.errors.length === 0
        }

        if (result.valid && lead) {
            validRows.push(lead)
            outcomes.push({
                index: i,
                row: lead.row,
                status: 'imported'
            })
        } else {
            outcomes.push({
                index: i,
                row: lead?.row ?? i + 1,
                status: 'skipped',
                reason: result.errors[0] || 'Invalid row'
            })
        }
    }

    let importedCount = 0
    if (validRows.length > 0) {
        try {
            await db.transaction(async (tx) => {
                for (const lead of validRows) {
                    const [inserted] = await tx
                        .insert(customers)
                        .values({
                            name: lead.name,
                            email: lead.email,
                            phone: lead.phone,
                            travelTime: lead.travelTime,
                            statusId: lead.statusId ?? 1,
                            priorityId: lead.priorityId ?? 1,
                            referralId: lead.referralId ?? null,
                            assignedTo: lead.assignedTo || session.user.id
                        })
                        .returning({ id: customers.id })

                    if (batchTagIds.length > 0) {
                        await tx.insert(customerTags).values(
                            batchTagIds.map((tagId) => ({
                                customerId: inserted.id,
                                tagId
                            }))
                        )
                    }

                    await tx.insert(logs).values({
                        customerId: inserted.id,
                        action: 'lead_imported',
                        changes: JSON.stringify({
                            name: lead.name,
                            email: lead.email,
                            phone: lead.phone,
                            travelTime: lead.travelTime,
                            statusId: lead.statusId ?? 1,
                            priorityId: lead.priorityId ?? 1,
                            referralId: lead.referralId ?? null,
                            assignedTo: lead.assignedTo || session.user.id,
                            ...(batchTagNames.length > 0
                                ? { tags: batchTagNames }
                                : {})
                        }),
                        userId: session.user.id
                    })

                    importedCount++
                }
            })
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to import leads'
            return NextResponse.json({ error: message }, { status: 500 })
        }
    }

    return NextResponse.json({
        imported: importedCount,
        skipped: outcomes.length - importedCount,
        outcomes
    })
}