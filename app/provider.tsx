'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider
            attribute='class'
            defaultTheme='system'
            enableSystem>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </NextThemesProvider>
    )
}
