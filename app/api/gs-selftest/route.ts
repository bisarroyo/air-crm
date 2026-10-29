import { NextResponse } from 'next/server'

// Retired: integration tests must never mutate a live database over HTTP.
export function GET() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
