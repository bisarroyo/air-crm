import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from './provider'
import { Header } from '@/components/header'

const poppins = Poppins({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin']
})

export const metadata: Metadata = {
    title: 'AIR CRM',
    description: 'SUUPORT FOR BETTER AUTH IN NEXT.JS 13+'
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang='es' suppressHydrationWarning>
            <body className={poppins.className}>
                <Providers>
                    <Header />
                    {children}
                    <Toaster richColors />
                </Providers>
            </body>
        </html>
    )
}
