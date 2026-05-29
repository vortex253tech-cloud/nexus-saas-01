// GET /api/nexus/voice/debug
// Diagnostic: tests the ephemeral client secret endpoint (current GA API).
import { NextResponse } from 'next/server'
import { REALTIME_MODEL } from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' })

  const key_hint = `${key.slice(0, 7)}...${key.slice(-4)}`

  let session_test: unknown
  try {
    const res = await fetch(CLIENT_SECRETS_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        session: {
          type:  'realtime',
          model: REALTIME_MODEL,
          audio: { output: { voice: 'verse' } },
        },
      }),
      signal: AbortSignal.timeout(10000),
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
    endpoint:     CLIENT_SECRETS_URL,
    approach:     'WebSocket (ephemeral token via /v1/realtime/client_secrets)',
    note:         'Browser connects via wss://api.openai.com/v1/realtime?model=gpt-realtime using ephemeral token as subprotocol.',
    session_test,
  })
}
