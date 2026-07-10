import { createAuthClient } from 'better-auth/react'

import { passkeyClient } from '@better-auth/passkey/client'
import {
    adminClient,
    organizationClient,
    oneTapClient,
    twoFactorClient
} from 'better-auth/client/plugins'

// import { ac, admin, user, agent } from '@/lib/permission'

export const authClient = createAuthClient({
    plugins: [
        organizationClient(),
        adminClient(),
        oneTapClient({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            promptOptions: {
                maxAttempts: 1
            }
        }),
        twoFactorClient({
            onTwoFactorRedirect() {
                window.location.href = '/two-factor'
            }
        }),
        passkeyClient()
    ]
})
