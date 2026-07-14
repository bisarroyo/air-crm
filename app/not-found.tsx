import { Frown } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
    return (
        <div className='flex flex-1 flex-col items-center justify-center gap-6 px-4 py-32 text-center'>
            <span className='select-none text-[10rem] font-bold leading-none tracking-tighter text-primary/10'>
                404
            </span>
            <Frown size={48} className='-mt-12 text-primary/30' />
            <div className='space-y-2'>
                <h1 className='text-xl font-medium'>Page not found</h1>
                <p className='text-sm text-muted-foreground'>
                    The page you&apos;re looking for doesn&apos;t exist or has
                    been moved.
                </p>
            </div>
            <Link
                href='/'
                className={cn(buttonVariants({ variant: 'default' }))}>
                Go back home
            </Link>
        </div>
    )
}
