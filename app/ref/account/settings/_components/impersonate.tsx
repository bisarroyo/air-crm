import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

import { useRouter } from 'next/navigation'
import { Loader2, StopCircle } from 'lucide-react'

export default function ImpersonateComponent({
    isSignOut,
    setIsSignOut
}: {
    isSignOut: boolean
    setIsSignOut: (value: boolean) => void
}) {
    const router = useRouter()
    return (
        <Button
            className='gap-2 z-10'
            variant='secondary'
            onClick={async () => {
                setIsSignOut(true)
                await authClient.admin.stopImpersonating()
                setIsSignOut(false)
                toast.info('Impersonation stopped successfully')
                router.push('/admin')
            }}
            disabled={isSignOut}>
            <span className='text-sm'>
                {isSignOut ? (
                    <Loader2 size={15} className='animate-spin' />
                ) : (
                    <div className='flex items-center gap-2'>
                        <StopCircle size={16} color='red' />
                        Stop Impersonation
                    </div>
                )}
            </span>
        </Button>
    )
}
