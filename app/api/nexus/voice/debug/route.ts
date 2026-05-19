// GET /api/nexus/voice/debug
// Checks OpenAI Realtime API availability. No auth required — internal diagnostic only.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' })

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { type: 'realtime', model: 'gpt-realtime', voice: 'alloy' } }),
      signal: AbortSignal.timeout(10000),
    })

    const body = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(body) } catch { parsed = body }

    return NextResponse.json({
      ok:          res.ok,
      status:      res.status,
      openai_body: parsed,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
