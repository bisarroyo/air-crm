'use client'

import {
    BarChart3,
    Flag,
    Gauge,
    Layers,
    Settings
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function AdminLayout({
    children
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const sections = [
        {
            label: null,
            items: [
                {
                    href: '/admin',
                    label: 'Dashboard',
                    icon: Gauge
                }
            ]
        },
        {
            label: 'Analytics',
            icon: BarChart3,
            items: [] as { href: string; label: string; icon: any }[]
        },
        {
            label: 'Settings',
            icon: Settings,
            items: [
                { href: '/admin/status', label: 'Status', icon: Flag },
                { href: '/admin/priority', label: 'Priority', icon: Layers }
            ]
        }
    ]

    const isActive = (href: string) =>
        href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(href)

    return (
        <div className='flex'>
            <aside className='flex h-[calc(100vh-3.5rem)] w-56 flex-col border-r bg-muted/20 p-4'>
                <nav className='flex flex-col gap-4'>
                    {sections.map((section, idx) => (
                        <div key={idx} className='flex flex-col gap-1'>
                            {section.label && (
                                <div className='flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                                    {section.icon && (
                                        <section.icon size={14} />
                                    )}
                                    {section.label}
                                </div>
                            )}
                            {section.items.length === 0 && section.label && (
                                <p className='px-3 text-xs text-muted-foreground/60 italic'>
                                    Coming soon
                                </p>
                            )}
                            {section.items.map(item => {
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                            isActive(item.href)
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}>
                                        <Icon size={16} />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>
            </aside>
            <main className='flex-1 overflow-y-auto p-6'>
                {children}
            </main>
        </div>
    )
}
