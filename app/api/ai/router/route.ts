import { NextRequest, NextResponse } from 'next/server'
import { resolveIntent } from '@/lib/ai/intent-router'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json() as { query?: string }
    if (!query?.trim()) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }
    const result = await resolveIntent(query)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
