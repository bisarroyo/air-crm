'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { SignUpForm } from '@/components/forms/sign-up-form'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { getCallbackURL } from '@/lib/shared'

export default function SignUp() {
    const router = useRouter()
    const params = useSearchParams()

    return (
        <Card className='w-full'>
            <CardHeader>
                <CardTitle className='text-lg md:text-xl'>Sign Up</CardTitle>
                <CardDescription className='text-xs md:text-sm'>
                    Enter your information to create an account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <SignUpForm
                    onSuccess={() => router.push(getCallbackURL(params))}
                    callbackURL={getCallbackURL(params)}
                />
            </CardContent>
            <CardFooter>
                <div className='flex justify-center w-full border-t pt-4'>
                    <p className='text-center text-sm'>
                        ¿Ya tienes una cuenta?{' '}
                        <Link
                            href='/signin'
                            className='transition-colors duration-300 hover:text-blue-600 underline'>
                            Iniciar sesión
                        </Link>
                    </p>
                </div>
            </CardFooter>
        </Card>
    )
}
