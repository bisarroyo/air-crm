import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

const publicRoutes = ['/signin', '/signup', '/forgot-password']

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (publicRoutes.includes(pathname)) {
        return NextResponse.next()
    }

    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.redirect(new URL('/signin', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
