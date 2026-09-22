'use client'

import {
    BarChart3,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    FileUp,
    Flag,
    Gauge,
    Home,
    Layers,
    Link2,
    Settings,
    ShieldCheck,
    Tag,
    User,
    UserCog,
    Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'
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
        const saved =
            typeof window !== 'undefined'
                ? sessionStorage.getItem('sidebar-open-sections')
                : null
        return saved ? new Set(JSON.parse(saved)) : new Set(['Main'])
    })

    if (!session) return null

    const isAuthPage =
        pathname.startsWith('/signin') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/forget-password') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/two-factor')

    if (isAuthPage) return null

    const toggleSection = (label: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev)
            if (next.has(label)) {
                next.delete(label)
            } else {
                next.add(label)
            }
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(
                    'sidebar-open-sections',
                    JSON.stringify([...next])
                )
            }
            return next
        })
    }

    const sections: MenuSection[] = [
        {
            label: 'Main',
            icon: Home,
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
                { href: '/leads', label: 'All Leads', icon: Users },
                {
                    href: '/leads/quotations',
                    label: 'Cotizaciones',
                    icon: FileText
                },
                { href: '/leads/import', label: 'Import', icon: FileUp }
            ]
        },
        {
            label: 'Account',
            icon: User,
            defaultOpen: pathname.startsWith('/account'),
            items: [{ href: '/account', label: 'Settings', icon: Settings }]
        },
        ...(session?.user.role === 'admin'
            ? [
                  {
                      label: 'Admin',
                      icon: ShieldCheck,
                      defaultOpen: pathname.startsWith('/admin'),
                      items: [
                          {
                              href: '/admin/users',
                              label: 'Users',
                              icon: UserCog
                          },
                          {
                              href: '/admin/status',
                              label: 'Status',
                              icon: Flag
                          },
                          {
                              href: '/admin/priority',
                              label: 'Priority',
                              icon: Layers
                          },
                          {
                              href: '/admin/referrals',
                              label: 'Referrals',
                              icon: Link2
                          },
                          { href: '/admin/tags', label: 'Tags', icon: Tag },
                          {
                              href: '/admin/quotations',
                              label: 'Cotizaciones',
                              icon: FileText
                          }
                      ]
                  } as MenuSection
              ]
            : [])
    ]

    const allItems = sections.flatMap((section) => section.items)

    const activeHref = (() => {
        let best: string | null = null
        for (const item of allItems) {
            const matches =
                item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/')
            if (matches && (best === null || item.href.length > best.length)) {
                best = item.href
            }
        }
        return best
    })()

    const isActive = (href: string) => href === activeHref

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
                    className='flex h-9 items-center justify-end px-3 text-muted-foreground hover:text-foreground'>
                    {collapsed ? (
                        <ChevronRight size={16} />
                    ) : (
                        <ChevronLeft size={16} />
                    )}
                </button>
                <nav className='flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-4'>
                    {sections.map((section) => {
                        const isOpen = openSections.has(section.label)
                        const SectionIcon = section.icon
                        const sectionActive = section.items.some((item) =>
                            isActive(item.href)
                        )

                        return (
                            <div key={section.label}>
                                {collapsed ? (
                                    <div className='my-1 flex flex-col items-center gap-1'>
                                        {SectionIcon && (
                                            <span
                                                className={cn(
                                                    'mb-1 text-muted-foreground/70',
                                                    sectionActive &&
                                                        'text-primary'
                                                )}
                                                aria-hidden>
                                                <SectionIcon size={16} />
                                            </span>
                                        )}
                                        {section.items.map((item) => {
                                            const Icon = item.icon
                                            const active = isActive(item.href)
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    aria-current={
                                                        active
                                                            ? 'page'
                                                            : undefined
                                                    }
                                                    className={cn(
                                                        'relative flex items-center justify-center rounded-lg p-2 transition-colors',
                                                        active
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    )}
                                                    title={item.label}>
                                                    {active && (
                                                        <span className='absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary' />
                                                    )}
                                                    <Icon size={20} />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() =>
                                                toggleSection(section.label)
                                            }
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors',
                                                sectionActive || isOpen
                                                    ? 'bg-accent text-white'
                                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                            )}>
                                            {SectionIcon && (
                                                <SectionIcon
                                                    size={14}
                                                    className={cn(
                                                        sectionActive &&
                                                            'text-primary'
                                                    )}
                                                />
                                            )}
                                            <span
                                                className={cn(
                                                    'flex-1 text-left',
                                                    sectionActive &&
                                                        'text-primary'
                                                )}>
                                                {section.label}
                                            </span>
                                            <ChevronDown
                                                size={14}
                                                className={cn(
                                                    'text-muted-foreground transition-transform',
                                                    isOpen && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className='mt-0.5 flex flex-col gap-0.5 border-l border-border/60 pl-2'>
                                                {section.items.map((item) => {
                                                    const Icon = item.icon
                                                    const active = isActive(
                                                        item.href
                                                    )
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            aria-current={
                                                                active
                                                                    ? 'page'
                                                                    : undefined
                                                            }
                                                            className={cn(
                                                                'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                                                active
                                                                    ? 'bg-primary/10 font-semibold text-primary'
                                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                            )}>
                                                            <Icon size={18} />
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
