'use client'

import { Loader2, LogOut } from 'lucide-react'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'

import { authClient } from '@/lib/auth-client'

import CardHeader from './_components/card-header'
import CardUser from './_components/card-user'
import VerifyEmail from './_components/verify-email'
import Sessions from './_components/sessions'
import PasskeysComponent from './_components/passkeys'
import TwoFactor from './_components/two-factor'
import ImpersonateComponent from './_components/impersonate'
import ChangePassword from './_components/change-password'

export default function UserCard() {
    const { data: session } = authClient.useSession()

    const signOut = () =>
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/signin'
                }
            }
        })

    const [isSignOut, setIsSignOut] = useState<boolean>(false)

    return (
        <Card>
            <CardHeader />
            <CardContent className='grid gap-8 grid-cols-1'>
                <CardUser session={session} />

                {session?.user.emailVerified ? null : (
                    <VerifyEmail session={session} />
                )}

                <Sessions currentSession={session} />

                <div className='border-y py-4 flex items-center flex-wrap justify-between gap-2'>
                    <PasskeysComponent />
                    <TwoFactor session={session} />
                </div>
            </CardContent>
            <CardFooter className='gap-2 justify-between items-center'>
                <ChangePassword />
                {session?.session.impersonatedBy ? (
                    <ImpersonateComponent
                        setIsSignOut={setIsSignOut}
                        isSignOut={isSignOut}
                    />
                ) : (
                    <Button
                        className='gap-2 z-10'
                        variant='secondary'
                        onClick={async () => {
                            setIsSignOut(true)
                            await signOut()
                            setIsSignOut(false)
                        }}
                        disabled={isSignOut}>
                        <span className='text-sm'>
                            {isSignOut ? (
                                <Loader2 size={15} className='animate-spin' />
                            ) : (
                                <div className='flex items-center gap-2'>
                                    <LogOut size={16} />
                                    Sign Out
                                </div>
                            )}
                        </span>
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
