'use client'

import SignUp from '@/app/(auth)/signup/_components/sign-up'
import { Suspense } from 'react'

export default function Page() {
    return (
        <div className='w-full'>
            <div className='flex items-center flex-col justify-center w-full md:py-10'>
                <div className='w-full max-w-md'>
                    <Suspense fallback={<div>Loading...</div>}>
                        <SignUp />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
