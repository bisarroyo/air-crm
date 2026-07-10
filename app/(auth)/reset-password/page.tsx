'use client'

import { ResetPasswordForm } from '@/components/forms/reset-password-form'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { Suspense } from 'react'

export default function Page() {
    return (
        <div className='flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]'>
            <Card className='w-[350px]'>
                <CardHeader>
                    <CardTitle>Restablecer contraseña</CardTitle>
                    <CardDescription>
                        Ingresa una nueva contraseña y su confirmación para
                        restablecer tu contraseña.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<div>Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
