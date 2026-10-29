import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { member, organization } from '@/auth-schema'
import { customers, travelLeads } from '@/db/schema'

type Session = {
    user: { id: string }
    session: { activeOrganizationId?: string | null }
} | null

export async function organizationAccess(session: Session, admin = false) {
    if (!session) return null
    const activeId = session.session.activeOrganizationId?.trim() || null
    const memberships = await db.select({ id: member.organizationId, role: member.role }).from(member)
        .where(eq(member.userId, session.user.id))
    if (memberships.length === 0) return null

    // Sessions created before the organization was provisioned (or before the
    // user picked one) have no active organization. When the user belongs to a
    // single organization there is nothing to choose, so use that membership.
    const membership = activeId
        ? memberships.find(row => row.id === activeId)
        : memberships.length === 1 ? memberships[0] : undefined
    if (!membership) return null

    const roles = membership.role.split(',').map(role => role.trim())
    if (admin && !roles.some(role => role === 'owner' || role === 'admin')) return null
    return membership.id
}

export async function canAccessLeads(session: Session, source: 'customer' | 'travel', ids: number[]) {
    const organizationId = await organizationAccess(session)
    if (!organizationId || !ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return false
    const table = source === 'customer' ? customers : travelLeads
    const rows = await db.select({ id: table.id }).from(table)
        .where(and(eq(table.organizationId, organizationId), inArray(table.id, ids)))
    return rows.length === new Set(ids).size
}

// The public form has no trusted organization in its request. Its destination
// must be selected by the deployment operator, never by an arbitrary body field.
export async function publicLeadOrganization() {
    const id = process.env.PUBLIC_LEADS_ORGANIZATION_ID?.trim()
    if (!id) return null
    const [row] = await db.select({ id: organization.id }).from(organization)
        .where(eq(organization.id, id)).limit(1)
    return row?.id ?? null
}
