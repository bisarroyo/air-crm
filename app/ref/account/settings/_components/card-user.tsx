'use client'

import { Session } from '@/lib/auth-types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import EditUserDialog from './edit-user-dialog'

export default function CardUser({ session }: { session: Session | null }) {
    return (
        <div className='flex flex-col gap-2'>
            <div className='flex items-start justify-between'>
                <div className='flex items-center gap-4'>
                    <Avatar className='hidden h-9 w-9 sm:flex '>
                        <AvatarImage
                            src={session?.user.image || undefined}
                            alt='Avatar'
                            className='object-cover'
                        />
                        <AvatarFallback>
                            {session?.user.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div className='grid'>
                        <div className='flex items-center gap-1'>
                            <p className='text-sm font-medium leading-none'>
                                {session?.user.name}
                            </p>
                        </div>
                        <p className='text-sm'>{session?.user.email}</p>
                    </div>
                </div>
                <EditUserDialog />
            </div>
        </div>
    )
}
