import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
    buildImportContext,
    parseImportRows,
    validateImportRow
} from '@/lib/leads-import-validate'
import type { ImportReviewResult } from '@/lib/leads-import'

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

    const ctx = await buildImportContext(
        session.user.id,
        session.user.role
    )

    const seenEmails = new Map<string, number>()
    const results: ImportReviewResult[] = []

    for (let i = 0; i < leads.length; i++) {
        const result = validateImportRow(leads[i], ctx, i + 1)

        if (result.lead) {
            const email = result.lead.email
            if (email) {
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
                    seenEmails.set(email, result.lead.row)
                }
            }
            result.valid = result.errors.length === 0
        }

        results.push({
            index: i,
            row: result.lead?.row ?? i + 1,
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
            lead: result.lead
        })
    }

    const valid = results.filter((r) => r.valid).length

    return NextResponse.json({
        results,
        summary: {
            total: results.length,
            valid,
            invalid: results.length - valid
        }
    })
}