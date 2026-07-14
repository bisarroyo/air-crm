'use client'

import {
    BarChart3,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Flag,
    Gauge,
    Layers,
    Link2,
    Settings,
    ShieldCheck,
    User,
    UserCog,
    Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'

interface MenuItem {
    href: string
    label: string
    icon: LucideIcon
}

interface MenuSection {
    label: string
    icon?: LucideIcon
    defaultOpen?: boolean
    items: MenuItem[]
}

export function Sidebar() {
    const pathname = usePathname()
    const { session } = useSession()

    const [collapsed, setCollapsed] = useState(false)
    const [openSections, setOpenSections] = useState<Set<string>>(() => {
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem('sidebar-open-sections') : null
        return saved ? new Set(JSON.parse(saved)) : new Set(['main'])
    })

    if (!session) return null

    const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/signup') ||
        pathname.startsWith('/forget-password') || pathname.startsWith('/reset-password') ||
        pathname.startsWith('/two-factor')

    if (isAuthPage) return null

    const toggleSection = (label: string) => {
        setOpenSections(prev => {
            const next = new Set(prev)
            if (next.has(label)) {
                next.delete(label)
            } else {
                next.add(label)
            }
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('sidebar-open-sections', JSON.stringify([...next]))
            }
            return next
        })
    }

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    const sections: MenuSection[] = [
        {
            label: 'main',
            defaultOpen: true,
            items: [
                { href: '/', label: 'Dashboard', icon: Gauge },
                { href: '/reports', label: 'Reports', icon: BarChart3 }
            ]
        },
        {
            label: 'Leads',
            icon: Users,
            defaultOpen: true,
            items: [
                { href: '/', label: 'All Leads', icon: Users }
            ]
        },
        {
            label: 'Account',
            icon: User,
            defaultOpen: pathname.startsWith('/account'),
            items: [
                { href: '/account', label: 'Settings', icon: Settings }
            ]
        },
        ...(session?.user.role === 'admin'
            ? [
                {
                    label: 'Admin',
                    icon: ShieldCheck,
                    defaultOpen: pathname.startsWith('/admin'),
                    items: [
                        { href: '/admin/users', label: 'Users', icon: UserCog },
                        { href: '/admin/status', label: 'Status', icon: Flag },
                        { href: '/admin/priority', label: 'Priority', icon: Layers },
                        { href: '/admin/referrals', label: 'Referrals', icon: Link2 }
                    ]
                } as MenuSection
            ]
            : [])
    ]

    return (
        <>
            {!collapsed && (
                <div
                    className='fixed inset-0 z-30 bg-black/20 md:hidden'
                    onClick={() => setCollapsed(true)}
                />
            )}
            <aside
                className={cn(
                    'fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] flex-col border-r bg-background transition-all duration-200 md:static',
                    collapsed ? 'w-14' : 'w-56'
                )}>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className='flex h-9 items-center justify-end px-3 text-muted-foreground hover:text-foreground'
                >
                    {collapsed ? (
                        <ChevronRight size={16} />
                    ) : (
                        <ChevronLeft size={16} />
                    )}
                </button>
                <nav className='flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4'>
                    {sections.map(section => {
                        const isOpen = openSections.has(section.label)
                        const SectionIcon = section.icon

                        return (
                            <div key={section.label}>
                                {collapsed ? (
                                    <div className='flex flex-col items-center gap-1 py-2'>
                                        {section.items.map(item => {
                                            const Icon = item.icon
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        'flex items-center justify-center rounded-lg p-2 transition-colors',
                                                        isActive(item.href)
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    )}
                                                    title={item.label}
                                                >
                                                    <Icon size={18} />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => toggleSection(section.label)}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                                                isOpen
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {SectionIcon && <SectionIcon size={14} />}
                                            <span className='flex-1 text-left'>{section.label}</span>
                                            <ChevronDown
                                                size={14}
                                                className={cn(
                                                    'transition-transform',
                                                    isOpen && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className='flex flex-col gap-0.5 pb-1'>
                                                {section.items.map(item => {
                                                    const Icon = item.icon
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            className={cn(
                                                                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                                                isActive(item.href)
                                                                    ? 'bg-primary/10 text-primary'
                                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                            )}
                                                        >
                                                            <Icon size={16} />
                                                            {item.label}
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </nav>
            </aside>
        </>
    )
}
