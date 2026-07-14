'use client'
import { ShieldX } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { authClient } from '@/lib/auth-client'

export default function PendingPage() {
    const signOut = () =>
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/signin'
                }
            }
        })
    return (
        <div className='flex flex-1 flex-col items-center justify-center gap-6 px-4 py-32 text-center'>
            <span className='flex size-20 items-center justify-center rounded-full bg-muted'>
                <ShieldX size={40} className='text-muted-foreground' />
            </span>
            <div className='space-y-2'>
                <h1 className='text-xl font-medium'>Access Pending</h1>
                <p className='mx-auto max-w-sm text-sm text-muted-foreground'>
                    Your account is awaiting approval. Please contact your
                    administrator to grant you access.
                </p>
            </div>
            <Button
                onClick={signOut}
                className={cn(buttonVariants({ variant: 'outline' }))}>
                Sign out
            </Button>
        </div>
    )
}
