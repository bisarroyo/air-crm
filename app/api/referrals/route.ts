import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { referrals } from '@/db/schema'
import { user } from '@/auth-schema'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const rows = await db
        .select({
            id: referrals.id,
            code: referrals.code,
            userId: referrals.userId,
            name: referrals.name,
            createdAt: referrals.createdAt,
            userName: user.name,
            userEmail: user.email
        })
        .from(referrals)
        .leftJoin(user, eq(referrals.userId, user.id))
        .orderBy(referrals.id)

    return NextResponse.json(rows)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.code || !body.userId) {
        return NextResponse.json(
            { error: 'El código y el usuario son obligatorios' },
            { status: 400 }
        )
    }

    try {
        const [record] = await db
            .insert(referrals)
            .values({
                code: body.code.trim(),
                userId: body.userId,
                name: body.name || null
            })
            .returning()

        return NextResponse.json(record, { status: 201 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create referral'
        if (message.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'Ya existe un referido con ese código' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
