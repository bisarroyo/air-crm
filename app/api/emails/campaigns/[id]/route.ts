import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
    deleteCampaign,
    getCampaignDetail,
    resetFailedRecipients,
    sendBatch
} from '@/lib/email/campaign'

type RouteParams = { params: Promise<{ id: string }> }

async function getActor() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return null
    return { id: session.user.id, role: session.user.role }
}

export async function GET(_request: Request, { params }: RouteParams) {
    const actor = await getActor()
    if (!actor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const detail = await getCampaignDetail(Number(id), actor)

    if (!detail) {
        return NextResponse.json(
            { error: 'Campaña no encontrada' },
            { status: 404 }
        )
    }

    return NextResponse.json(detail)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const actor = await getActor()
    if (!actor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await deleteCampaign(Number(id), actor)

    if ('error' in result) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        )
    }

    return NextResponse.json({ success: true })
}

/**
 * Acción sobre la campaña: `send` envía un lote, `retry` devuelve los fallidos
 * a la cola. El body llega desde el bucle del navegador.
 */
export async function POST(request: Request, { params }: RouteParams) {
    const actor = await getActor()
    if (!actor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const campaignId = Number(id)

    let body: { action?: string; batchSize?: number }
    try {
        body = await request.json()
    } catch {
        body = {}
    }

    if (body.action === 'retry') {
        const result = await resetFailedRecipients(campaignId, actor)
        if ('error' in result) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        return NextResponse.json({ success: true })
    }

    const result = await sendBatch(campaignId, actor, Number(body.batchSize))

    if ('error' in result) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        )
    }

    return NextResponse.json(result)
}