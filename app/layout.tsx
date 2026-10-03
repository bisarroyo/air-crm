import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from './provider'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'

const poppins = Poppins({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin']
})

export const metadata: Metadata = {
    title: 'AIR CRM',
    description: 'CRM de ventas y cotizaciones para S Travel Costa Rica'
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang='es' suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{var t=localStorage.getItem('app-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`
                    }}
                />
            </head>
            <body className={poppins.className}>
                <Providers>
                    <Header />
                    <div className='flex h-[calc(100vh-3.5rem)] overflow-hidden'>
                        <Sidebar />
                        <main className='flex-1 overflow-x-hidden overflow-y-auto'>
                            {children}
                        </main>
                    </div>
                    <Toaster richColors />
                </Providers>
            </body>
        </html>
    )
}
