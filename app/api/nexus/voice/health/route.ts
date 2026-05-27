// GET /api/nexus/voice/health
// Lightweight liveness check: confirms OPENAI_API_KEY is set and model target.
// Does NOT make a network call to OpenAI (fast, no latency, no cost).
// For a deeper test hit /api/nexus/voice/debug which calls /v1/realtime/sessions.

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 5

export async function GET() {
  const key = process.env.OPENAI_API_KEY

  if (!key) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY missing — configure em Vercel → Settings → Environment Variables' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    success:   true,
    realtime:  'online',
    websocket: 'ready',
    model:     'gpt-4o-realtime-preview',
    key_hint:  `${key.slice(0, 7)}...${key.slice(-4)}`,
  })
}
