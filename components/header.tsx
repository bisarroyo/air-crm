'use client'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { ThemePicker } from '@/components/theme-picker'
import { authClient } from '@/lib/auth-client'
import { cn } from 'cn'

import { useSession } from '@/hooks/use-session'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { Button } from '@/components/ui/button'

import { Blobatar } from '@blobatar/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOutIcon, ShieldCheck, UserRoundIcon, UserX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function Header() {
    const { session, isPending } = useSession()
    const router = useRouter()

    const signOut = () =>
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/signin'
                }
            }
        })

    const stopImpersonating = async () => {
        await authClient.admin.stopImpersonating()
        router.refresh()
    }

    const isImpersonating = !!session?.session?.impersonatedBy

    const profileHref =
        session?.user.role === 'ref'
            ? '/ref/account'
            : session?.user.role === 'admin' || session?.user.role === 'user'
              ? '/account'
              : null

    return (
        <>
            {isImpersonating && (
                <div className='fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-1 font-medium'>
                    Suplantando a {session?.user.name} ({session?.user.email})
                    <button
                        onClick={stopImpersonating}
                        className='ml-3 underline hover:no-underline cursor-pointer'>
                        Dejar de suplantar
                    </button>
                </div>
            )}
            <header
                className={cn(
                    'flex h-14 align-center justify-center px-4 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 backdrop-blur-xl bg-white/10 dark:bg-neutral-900/10 border-b border-neutral-400/20 dark:border-neutral-700/20 supports-backdrop-filter:backdrop-blur-lg',
                    isImpersonating && 'mt-8'
                )}>
                <section className='max-w-7xl w-full justify-between mx-auto flex-row flex items-center'>
                    <div className='font-headline-md text-2xl font-black tracking-[6px] dark:text-white'>
                        <Link href={'/'}>CRM</Link>
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
                                                {session?.user?.image ? (
                                                    <Avatar>
                                                        <AvatarImage
                                                            src={
                                                                session.user
                                                                    .image
                                                            }
                                                            alt='Avatar del usuario'
                                                        />
                                                        <AvatarFallback>
                                                            {session.user.name
                                                                ?.slice(0, 2)
                                                                .toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <Blobatar
                                                        name={
                                                            session?.user
                                                                ?.name ||
                                                            session?.user
                                                                ?.email ||
                                                            'user'
                                                        }
                                                        size={32}
                                                        background='circle'
                                                        className='rounded-full'
                                                        alt={
                                                            session?.user
                                                                ?.name ||
                                                            'Avatar del usuario'
                                                        }
                                                    />
                                                )}
                                            </Button>
                                        }
                                    />
                                )}
                                <DropdownMenuContent align='end'>
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>
                                            {session?.user?.name ||
                                                session?.user?.email}
                                        </DropdownMenuLabel>
                                        {profileHref && (
                                            <Link href={profileHref}>
                                                <DropdownMenuItem className='whitespace-nowrap'>
                                                    <UserRoundIcon />
                                                    Mi perfil
                                                </DropdownMenuItem>
                                            </Link>
                                        )}
                                        {session?.user.role === 'admin' && (
                                            <Link href={'/admin'}>
                                                <DropdownMenuItem className='whitespace-nowrap'>
                                                    <ShieldCheck />
                                                    Administración
                                                </DropdownMenuItem>
                                            </Link>
                                        )}
                                        {isImpersonating && (
                                            <DropdownMenuItem
                                                className='whitespace-nowrap'
                                                onClick={stopImpersonating}>
                                                <UserX />
                                                Dejar de suplantar
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className='whitespace-nowrap'
                                        onClick={signOut}
                                        variant='destructive'>
                                        <LogOutIcon />
                                        Cerrar sesión
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <div className='flex items-center gap-3'>
                            <ThemePicker />
                            <ModeToggle />
                        </div>
                    </div>
                </section>
            </header>
        </>
    )
}
