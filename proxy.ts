import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

const publicRoutes = ['/signin', '/signup', '/forget-password', '/reset-password', '/two-factor']

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.redirect(new URL('/signin', request.url))
    }

    const role = session.user?.role

    if (role === 'pending' && !pathname.startsWith('/pending') && !pathname.startsWith('/api')) {
        return NextResponse.redirect(new URL('/pending', request.url))
    }

    if (role === 'ref' && !pathname.startsWith('/ref') && !pathname.startsWith('/api')) {
        return NextResponse.redirect(new URL('/ref', request.url))
    }

    if (pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    if (pathname.startsWith('/ref') && role !== 'ref') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    if (pathname.startsWith('/pending') && role !== 'pending') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
