import { db } from '@/db'
import { customers, referrals, status, priority } from '@/db/schema'
import { user } from '@/auth-schema'
import {
    IMPORT_MAX_ROWS,
    normalizeTravelTime,
    type NormalizedLeadRow,
    type RawImportRow
} from '@/lib/leads-import'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_STATUS_ID = 1
const DEFAULT_PRIORITY_ID = 1

export interface ImportContext {
    sessionUser: {
        id: string
        role: string | undefined | null
    }
    existingEmails: Set<string>
    validStatusIds: Set<number>
    validPriorityIds: Set<number>
    validUserIds: Set<string>
    referralByCode: Map<string, number>
    validReferralIds: Set<number>
}

export async function buildImportContext(
    sessionUserId: string,
    role: string | undefined | null
): Promise<ImportContext> {
    const [statusRows, priorityRows, referralRows, existingCustomers, users] =
        await Promise.all([
            db.select({ id: status.id }).from(status),
            db.select({ id: priority.id }).from(priority),
            db.select({ id: referrals.id, code: referrals.code }).from(referrals),
            db.select({ email: customers.email }).from(customers),
            db.select({ id: user.id }).from(user)
        ])

    const referralByCode = new Map<string, number>()
    for (const r of referralRows) {
        referralByCode.set(r.code.toLowerCase(), r.id)
    }

    return {
        sessionUser: { id: sessionUserId, role },
        existingEmails: new Set(
            existingCustomers.map((c) => c.email.trim().toLowerCase())
        ),
        validStatusIds: new Set(statusRows.map((s) => s.id)),
        validPriorityIds: new Set(priorityRows.map((p) => p.id)),
        validUserIds: new Set(users.map((u) => u.id)),
        referralByCode,
        validReferralIds: new Set(referralRows.map((r) => r.id))
    }
}

export interface RowValidation {
    valid: boolean
    errors: string[]
    warnings: string[]
    lead: NormalizedLeadRow
}

export function validateImportRow(
    raw: RawImportRow,
    ctx: ImportContext,
    rowNumber: number
): RowValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const isAdmin = ctx.sessionUser.role === 'admin'

    const name = (raw.name || '').trim()
    const email = (raw.email || '').trim().toLowerCase()
    const phone = (raw.phone || '').trim()
    const travelTime = normalizeTravelTime(raw.travelTime || '')

    if (!name) {
        errors.push('Name is required')
    } else if (name.length > 255) {
        errors.push('Name cannot exceed 255 characters')
    }

    if (!email) {
        errors.push('Email is required')
    } else if (!EMAIL_REGEX.test(email)) {
        errors.push('Invalid email')
    }

    if (!phone) {
        errors.push('Phone is required')
    } else if (!/\d/.test(phone)) {
        errors.push('Phone must contain at least one digit')
    }

    if (!travelTime) {
        errors.push(
            'Travel time is required (values: 0-3, 3-6, 6-12, 12-18, 0)'
        )
    }

    const country = (raw.country || '').trim()
    if (country.length > 255) {
        errors.push('Country cannot exceed 255 characters')
    }

    let statusId = DEFAULT_STATUS_ID
    if (raw.statusId !== undefined && raw.statusId !== null && raw.statusId !== '') {
        const parsed = Number(raw.statusId)
        if (!Number.isInteger(parsed) || !ctx.validStatusIds.has(parsed)) {
            errors.push(`Invalid status: ${raw.statusId}`)
        } else {
            statusId = parsed
        }
    }

    let priorityId = DEFAULT_PRIORITY_ID
    if (
        raw.priorityId !== undefined &&
        raw.priorityId !== null &&
        raw.priorityId !== ''
    ) {
        const parsed = Number(raw.priorityId)
        if (!Number.isInteger(parsed) || !ctx.validPriorityIds.has(parsed)) {
            errors.push(`Invalid priority: ${raw.priorityId}`)
        } else {
            priorityId = parsed
        }
    }

    let referralId: number | null = null
    if (
        raw.referralId !== undefined &&
        raw.referralId !== null &&
        raw.referralId !== ''
    ) {
        const parsed = Number(raw.referralId)
        if (!Number.isInteger(parsed) || !ctx.validReferralIds.has(parsed)) {
            errors.push(`Invalid referral: ${raw.referralId}`)
        } else {
            referralId = parsed
        }
    } else if (raw.referralCode) {
        const code = raw.referralCode.trim()
        const found = ctx.referralByCode.get(code.toLowerCase())
        if (found) {
            referralId = found
        } else {
            warnings.push(`Referral code not found: ${code}`)
        }
    }

    let assignedTo = ctx.sessionUser.id
    if (isAdmin && raw.assignedTo) {
        const target = raw.assignedTo.trim()
        if (ctx.validUserIds.has(target)) {
            assignedTo = target
        } else {
            warnings.push(
                'Assigned user not found; will be assigned to the current user'
            )
        }
    } else if (!isAdmin && raw.assignedTo) {
        warnings.push(
            'Only admins can assign; will be assigned to the current user'
        )
    }

    const valid = errors.length === 0

    const lead: NormalizedLeadRow = {
        row: rowNumber,
        name,
        email,
        phone,
        travelTime,
        country: country || undefined,
        statusId,
        priorityId,
        referralId,
        assignedTo
    }

    return { valid, errors, warnings, lead }
}

export interface ImportRequest {
    leads?: unknown
}

export function parseImportRows(body: ImportRequest): RawImportRow[] | null {
    if (!body?.leads || !Array.isArray(body.leads)) return null
    if (body.leads.length === 0 || body.leads.length > IMPORT_MAX_ROWS) {
        return null
    }
    return body.leads as RawImportRow[]
}