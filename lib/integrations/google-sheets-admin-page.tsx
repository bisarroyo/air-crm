import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { GoogleSheetsOrganizationAccess } from '@/components/integrations/google-sheets-organization-access'
import { member, organization } from '@/auth-schema'
import { db } from '@/db'
import { auth } from '@/lib/auth'
import { organizationAccess } from '@/lib/organization-access'

export type GoogleSheetsPageAccess =
    | { organizationId: string }
    | { denied: React.ReactElement }

/**
 * Shared guard for the Google Sheets admin pages. Returns either the active
 * organization or the "choose organization" screen rendered by the caller.
 */
export async function googleSheetsPageAccess(): Promise<GoogleSheetsPageAccess> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) redirect('/signin')

    const organizationId = await organizationAccess(session, true)
    if (!organizationId) {
        const memberships = await db
            .select({
                id: organization.id,
                name: organization.name,
                role: member.role
            })
            .from(member)
            .innerJoin(organization, eq(organization.id, member.organizationId))
            .where(eq(member.userId, session.user.id))

        return {
            denied: (
                <GoogleSheetsOrganizationAccess
                    organizations={memberships}
                    activeOrganizationId={
                        session.session.activeOrganizationId ?? null
                    }
                />
            )
        }
    }

    return { organizationId }
}
