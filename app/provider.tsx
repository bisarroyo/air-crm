'use client'

import { ClientThemeProvider } from '@wrksz/themes/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ClientThemeProvider attribute='class' defaultTheme='system' enableSystem>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </ClientThemeProvider>
    )
}
