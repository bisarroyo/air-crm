'use client'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { authClient } from '@/lib/auth-client'

import { useSession } from '@/hooks/use-session'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { Button } from '@/components/ui/button'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    BadgeCheckIcon,
    BellIcon,
    CreditCardIcon,
    LogOut,
    LogOutIcon,
    ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

export function Header() {
    const { session, isPending } = useSession()

    const signOut = () =>
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/signin'
                }
            }
        })

    return (
        <header
            className='
            flex h-14 align-center justify-center px-4 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12
        backdrop-blur-xl bg-white/10 dark:bg-neutral-900/10
        border-b border-neutral-400/20 dark:border-neutral-700/20        supports-backdrop-filter:backdrop-blur-lg
      '>
            <section className='max-w-7xl w-full justify-between mx-auto flex-row flex items-center'>
                <div className='font-headline-md text-2xl font-black tracking-[6px] dark:text-white'>
                    <Link href={'/'}>AIR</Link>
                </div>
                <div className='flex justify-end gap-2'>
                    {session && (
                        <DropdownMenu>
                            {isPending ? (
                                <div className='h-8 w-8 rounded-full bg-muted animate-pulse' />
                            ) : (
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            className='rounded-full cursor-pointer'>
                                            <Avatar>
                                                <AvatarImage
                                                    src={
                                                        session?.user.image ||
                                                        '/avatar-placeholder.png'
                                                    }
                                                    alt='shadcn'
                                                />
                                                <AvatarFallback>
                                                    {session?.user?.name
                                                        ?.slice(0, 2)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Button>
                                    }
                                />
                            )}
                            <DropdownMenuContent align='end'>
                                <DropdownMenuGroup>
                                    <DropdownMenuItem>
                                        <BadgeCheckIcon />
                                        Account
                                    </DropdownMenuItem>
                                    {session?.user.role === 'admin' && (
                                        <Link href={'/admin'}>
                                            <DropdownMenuItem>
                                                <ShieldCheck />
                                                Admin Panel
                                            </DropdownMenuItem>
                                        </Link>
                                    )}
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={signOut}
                                    variant='destructive'>
                                    <LogOutIcon />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <div className='flex items-center gap-3'>
                        <ModeToggle />
                    </div>
                </div>
            </section>
        </header>
    )
}
