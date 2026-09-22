'use client'

import { useEffect, useState } from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Check, Palette } from 'lucide-react'
import { cn } from 'cn'

const THEMES = [
    { id: '', label: 'Default', color: '#f97316' },
    { id: 'blue', label: 'Blue', color: '#3b82f6' },
    { id: 'turquoise', label: 'Turquoise', color: '#14b8a6' },
    { id: 'red', label: 'Red', color: '#ef4444' },
    { id: 'green', label: 'Green', color: '#22c55e' }
]

function getInitialTheme() {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('app-theme') || ''
}

export function ThemePicker() {
    const [theme, setTheme] = useState(getInitialTheme)

    useEffect(() => {
        if (theme) {
            document.documentElement.dataset.theme = theme
        } else {
            delete document.documentElement.dataset.theme
        }
    }, [theme])

    const applyTheme = (id: string) => {
        setTheme(id)
        if (id) {
            localStorage.setItem('app-theme', id)
        } else {
            localStorage.removeItem('app-theme')
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant='outline'
                        size='icon'
                        className='rounded-full backdrop-blur-md h-8 w-8 cursor-pointer'
                        title='Theme'>
                        <Palette className='h-[1.2rem] w-[1.2rem]' />
                    </Button>
                }
            />
            <DropdownMenuContent align='end'>
                <DropdownMenuGroup>
                    {THEMES.map(t => (
                        <DropdownMenuItem
                            key={t.id || 'default'}
                            onClick={() => applyTheme(t.id)}
                            className='gap-2 cursor-pointer'>
                            <span
                                className='size-3 rounded-full ring-1 ring-border'
                                style={{ backgroundColor: t.color }}
                            />
                            {t.label}
                            <Check
                                className={cn(
                                    'ml-auto size-4 transition-opacity',
                                    theme === t.id ? 'opacity-100' : 'opacity-0'
                                )}
                            />
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}