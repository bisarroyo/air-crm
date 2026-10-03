import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { tags } from '@/db/schema'

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const allTags = await db.select().from(tags).orderBy(tags.id)
    return NextResponse.json(allTags)
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const tagName = body.tag

    if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
        return NextResponse.json(
            { error: 'El nombre de la etiqueta es obligatorio' },
            { status: 400 }
        )
    }

    try {
        const [newTag] = await db
            .insert(tags)
            .values({
                tag: tagName.trim(),
                color: body.color || '#6b7280'
            })
            .returning()
        return NextResponse.json(newTag, { status: 201 })
    } catch (error) {
        if ((error as Error)?.message?.includes('UNIQUE')) {
            return NextResponse.json(
                { error: 'Ya existe una etiqueta con ese nombre' },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: 'No se pudo crear la etiqueta' },
            { status: 500 }
        )
    }
}