import * as authSchema from '@/auth-schema'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { referrals } from '@/db/schema'

import { betterAuth } from 'better-auth'
import { passkey } from '@better-auth/passkey'
import { nextCookies } from 'better-auth/next-js'

import { reactInvitationEmail } from './email/invitation'
import { resend } from './email/resend'
import { reactResetPasswordEmail } from './email/reset-password'

import { ac, admin, ref, user } from '@/lib/permissions'

import {
    organization,
    admin as adminPlugin,
    oneTap,
    twoFactor
} from 'better-auth/plugins'

const from = process.env.BETTER_AUTH_EMAIL || 'delivered@resend.dev'
const to = process.env.TEST_EMAIL || ''

export const auth = betterAuth({
    appName: 'authcrm',
    database: drizzleAdapter(db, {
        provider: 'sqlite',
        schema: authSchema
    }),
    databaseHooks: {
        user: {
            create: {
                async after(user) {
                    if (user.role === 'ref') {
                        const code = user.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '')
                            .slice(0, 8) + Math.random().toString(36).slice(2, 6)
                        await db.insert(referrals).values({
                            code,
                            userId: user.id,
                            name: `${user.name} (auto)`
                        })
                    }
                }
            }
        }
    },
    plugins: [
        adminPlugin({
            defaultRole: 'user',
            ac,
            roles: { admin, ref, user }
        }),
        organization({
            async sendInvitationEmail(data) {
                await resend.emails.send({
                    from,
                    to: data.email,
                    subject: "You've been invited to join an organization",
                    react: reactInvitationEmail({
                        username: data.email,
                        invitedByUsername: data.inviter.user.name,
                        invitedByEmail: data.inviter.user.email,
                        teamName: data.organization.name,
                        inviteLink:
                            process.env.NODE_ENV === 'development'
                                ? `http://localhost:3000/accept-invitation/${data.id}`
                                : `${
                                      process.env.BETTER_AUTH_URL ||
                                      'https://demo.better-auth.com'
                                  }/accept-invitation/${data.id}`
                    })
                })
            }
        }),
        twoFactor({
            otpOptions: {
                async sendOTP({ user, otp }) {
                    await resend.emails.send({
                        from,
                        to: user.email,
                        subject: 'Your OTP',
                        html: `Your OTP is ${otp}`
                    })
                }
            }
        }),
        passkey(),
        nextCookies(),
        oneTap()
    ],

    emailAndPassword: {
        enabled: true,
        async sendResetPassword({ user, url }) {
            await resend.emails.send({
                from,
                to: user.email,
                subject: 'Restablecer tu contraseña',
                react: reactResetPasswordEmail({
                    username: user.email,
                    resetLink: url
                })
            })
        }
    },
    emailVerification: {
        async sendVerificationEmail({ user, url }) {
            const res = await resend.emails.send({
                from,
                to: to || user.email,
                subject: 'Verify your email address',
                html: `<a href="${url}">Verify your email address</a>`
            })
            console.log(res, user.email)
        }
    },
    account: {
        accountLinking: {
            trustedProviders: ['google', 'better-auth']
        }
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
        }
    }
})
