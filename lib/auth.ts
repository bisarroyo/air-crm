import * as authSchema from '@/auth-schema'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'

import { betterAuth } from 'better-auth'
import { passkey } from '@better-auth/passkey'
import { nextCookies } from 'better-auth/next-js'

import { reactInvitationEmail } from './email/invitation'
import { resend } from './email/resend'
import { reactResetPasswordEmail } from './email/reset-password'

// import { ac, admin, user, agent } from '@/lib/permission'

import {
    organization,
    admin as adminPlugin,
    openAPI,
    multiSession,
    oneTap,
    twoFactor
} from 'better-auth/plugins'

const from = process.env.BETTER_AUTH_EMAIL || 'delivered@resend.dev'
const to = process.env.TEST_EMAIL || ''

export const auth = betterAuth({
    appName: 'better-auth',
    database: drizzleAdapter(db, {
        provider: 'sqlite', // or "pg" or "mysql"
        schema: authSchema
    }),
    plugins: [
        adminPlugin({
            defaultRole: 'user'
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
        openAPI(),
        multiSession(),
        nextCookies(),
        oneTap()
    ], //pendiente

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
