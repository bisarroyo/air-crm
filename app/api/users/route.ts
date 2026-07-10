import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/auth-schema'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
        })
        .from(user)

    return NextResponse.json(users)
}
