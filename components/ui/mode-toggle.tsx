'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ModeToggle() {
    const { setTheme, theme } = useTheme()

    return (
        <Button
            variant='outline'
            size='icon'
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className='rounded-full backdrop-blur-md h-8 w-8'>
            <Sun className='h-[1.2rem] w-[1.2rem] rotate-0 scale-100 dark:-rotate-90 dark:scale-0 transition-all' />
            <Moon className='h-[1.2rem] w-[1.2rem] absolute rotate-90 scale-0 dark:rotate-0 dark:scale-100 transition-all' />
        </Button>
    )
}
