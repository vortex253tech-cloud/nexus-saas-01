// POST /api/nexus/voice/session
// Creates an ephemeral OpenAI Realtime API token for browser-side WebSocket connection.
// Uses the current GA endpoint: POST https://api.openai.com/v1/realtime/client_secrets
// (replaces deprecated /v1/realtime/sessions)
// The ephemeral key expires in ~1 minute and is safe to expose to the browser.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { REALTIME_MODEL }            from '@/lib/voice/realtime-config'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY não configurada no servidor.',
    }, { status: 503 })
  }

  try {
    const res = await fetch(CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        session: {
          type:  'realtime',
          model: REALTIME_MODEL,
          audio: { output: { voice: 'verse' } },
        },
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[voice/session] OpenAI error:', res.status, text)

      let friendlyError = `OpenAI ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) friendlyError = parsed.error.message
      } catch { /* use raw text */ }

      return NextResponse.json({
        error:   friendlyError,
        details: text,
        status:  res.status,
      }, { status: 502 })
    }

    const raw = await res.text()
    console.log('[voice/session] OpenAI response:', raw.slice(0, 400))

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(raw) } catch { /* non-JSON */ }

    type MaybeSecret = { value?: string; expires_at?: number } | undefined
    const csObj   = data?.client_secret as MaybeSecret
    const ekValue = csObj?.value ?? null

    if (!ekValue) {
      console.error('[voice/session] No ephemeral key found in:', raw.slice(0, 400))
      return NextResponse.json(
        { error: 'OpenAI did not return an ephemeral key', raw: raw.slice(0, 400) },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ephemeral_key: ekValue,
      expires_at:    csObj?.expires_at ?? null,
      model:         REALTIME_MODEL,
    })
  } catch (err) {
    console.error('[voice/session] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
