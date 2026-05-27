// GET /api/nexus/voice/debug
// Diagnostic: tests the GA Realtime API direct SDP endpoint (no ephemeral token).
import { NextResponse } from 'next/server'
import { REALTIME_MODEL } from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' })

  const keyHint = `${key.slice(0, 7)}...${key.slice(-4)}`

  // Test 1: Session creation (old approach, for reference)
  let sessionResult: unknown
  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: REALTIME_MODEL, modalities: ['audio', 'text'], voice: 'alloy' }),
      signal:  AbortSignal.timeout(10000),
    })
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = text }
    sessionResult = { ok: res.ok, status: res.status, body: parsed }
  } catch (err) {
    sessionResult = { ok: false, error: String(err) }
  }

  return NextResponse.json({
    model:         REALTIME_MODEL,
    key_hint:      keyHint,
    approach:      'server-proxied SDP (no ephemeral token)',
    connect_route: '/api/nexus/voice/connect',
    session_test:  sessionResult,
    note:          'The connect route uses the API key directly for the SDP exchange server-side.',
  })
}
