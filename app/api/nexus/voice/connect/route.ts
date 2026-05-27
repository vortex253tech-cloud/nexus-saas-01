// POST /api/nexus/voice/connect
// Returns WebSocket connection info for the OpenAI Realtime API (GA).
// Creates an ephemeral token server-side and returns the WS URL + token for the browser.
// Browser then opens: new WebSocket(ws_url, ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1'])

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { REALTIME_MODEL }            from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  void req

  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY não configurada. Acesse Vercel → Settings → Environment Variables.',
    }, { status: 503 })
  }

  try {
    // Create ephemeral token via GA sessions endpoint
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      REALTIME_MODEL,
        modalities: ['audio', 'text'],
        voice:      'alloy',
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[voice/connect] session creation error:', res.status, text.slice(0, 400))

      let msg = `OpenAI ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) msg = parsed.error.message
      } catch { /* use raw */ }

      if (res.status === 401) msg += ' — Verifique OPENAI_API_KEY no Vercel'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const data = await res.json() as {
      client_secret?: { value?: string; expires_at?: number }
      model?:         string
    }

    const token     = data.client_secret?.value
    const expiresAt = data.client_secret?.expires_at

    if (!token) {
      return NextResponse.json({ error: 'OpenAI did not return ephemeral token' }, { status: 502 })
    }

    return NextResponse.json({
      ok:          true,
      ephemeral_key: token,
      expires_at:    expiresAt ?? null,
      model:         REALTIME_MODEL,
      ws_url:        `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
      protocols:     ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1'],
    })
  } catch (err) {
    console.error('[voice/connect] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
