// POST /api/nexus/voice/connect
// Creates an ephemeral OpenAI Realtime session.
// Returns the raw OpenAI response so the browser can extract client_secret.value
// and open: new WebSocket(wss://api.openai.com/v1/realtime?model=…, [subprotocols])

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  void req

  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Acesse Vercel → Settings → Environment Variables.' },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(
      'https://api.openai.com/v1/realtime/sessions',
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
          'OpenAI-Beta':   'realtime=v1',
        },
        body:   JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'alloy',
        }),
        signal: AbortSignal.timeout(12000),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('[voice/connect] OpenAI error:', response.status, text.slice(0, 400))

      let msg = `OpenAI ${response.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) msg = parsed.error.message
      } catch { /* use raw */ }

      return NextResponse.json({ error: msg }, { status: 502 })
    }

    return NextResponse.json(await response.json())
  } catch (err) {
    console.error('[voice/connect] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
