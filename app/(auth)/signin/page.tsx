'use client'

import SignIn from '@/app/(auth)/signin/_components/sign-in'
import { Suspense } from 'react'

export default function Page() {
    return (
        <div className='w-full'>
            <div className='flex items-center flex-col justify-center w-full md:py-10'>
                <div className='w-full max-w-md'>
                    <Suspense fallback={<div>Loading...</div>}>
                        <SignIn />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
