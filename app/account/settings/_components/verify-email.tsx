import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { Session } from '@/lib/auth-types'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function VerifyEmail({ session }: { session: Session | null }) {
    const [emailVerificationPending, setEmailVerificationPending] =
        useState<boolean>(false)
    return (
        <Alert variant='default'>
            <AlertTitle>Verifica tu correo electrónico</AlertTitle>
            <AlertDescription className='text-muted-foreground'>
                Por favor verifica tu correo electrónico para asegurar la
                seguridad de tu cuenta.
                <Button
                    size='sm'
                    variant='secondary'
                    className='mt-2'
                    onClick={async () => {
                        await authClient.sendVerificationEmail(
                            {
                                email: session?.user.email || ''
                            },
                            {
                                onRequest(context) {
                                    setEmailVerificationPending(true)
                                },
                                onError(context: {
                                    error: { message: string }
                                }) {
                                    toast.error(context.error.message)
                                    setEmailVerificationPending(false)
                                },
                                onSuccess() {
                                    toast.success(
                                        'Correo de verificación enviado con éxito'
                                    )
                                    setEmailVerificationPending(false)
                                }
                            }
                        )
                    }}>
                    {emailVerificationPending ? (
                        <Loader2 size={15} className='animate-spin' />
                    ) : (
                        'Enviar correo de verificación'
                    )}
                </Button>
            </AlertDescription>
        </Alert>
    )
}
