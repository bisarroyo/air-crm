'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

export default function RefLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { session } = useSession()
    const router = useRouter()

    if (!session) return null

    const navItems = [
        { href: '/ref', label: 'Dashboard', icon: LayoutDashboard }
    ]

    const handleSignOut = async () => {
        await authClient.signOut()
        router.push('/signin')
    }

    return (
        <div className='flex min-h-screen'>
            <aside className='fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r bg-background'>
                <div className='flex h-14 items-center border-b px-4'>
                    <span className='text-sm font-semibold'>Referral Portal</span>
                </div>
                <nav className='flex flex-1 flex-col gap-1 overflow-y-auto p-2'>
                    {navItems.map(item => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}>
                                <Icon size={16} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
                <div className='border-t p-2'>
                    <div className='flex items-center gap-2 px-3 py-2'>
                        <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium truncate'>{session.user.name}</p>
                            <p className='text-xs text-muted-foreground truncate'>{session.user.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>
            <main className='flex-1 ml-56'>{children}</main>
        </div>
    )
}
