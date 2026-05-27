// GET /api/nexus/voice/debug
// Diagnostic: tests the ephemeral token endpoint and verifies API key access.
import { NextResponse } from 'next/server'
import { REALTIME_MODEL } from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' })

  const key_hint = `${key.slice(0, 7)}...${key.slice(-4)}`

  // Test: ephemeral token creation (same call the session route makes)
  let session_test: unknown
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
    session_test = { ok: res.ok, status: res.status, body: parsed }
  } catch (err) {
    session_test = { ok: false, error: String(err) }
  }

  return NextResponse.json({
    ok:           true,
    model:        REALTIME_MODEL,
    key_hint,
    approach:     'WebSocket (ephemeral token via /v1/realtime/sessions)',
    note:         'Browser connects via wss://api.openai.com/v1/realtime using ephemeral token as subprotocol.',
    session_test,
  })
}
