// POST /api/nexus/voice/session
// Creates an ephemeral OpenAI Realtime API token for browser-side WebRTC connection.
// Uses the GA endpoint: POST https://api.openai.com/v1/realtime/sessions
// The ephemeral key expires in ~1 minute and is safe to expose to the browser.
// Full session config (instructions, tools, turn_detection) is sent via session.update
// over the DataChannel after WebRTC connects — avoids sending unsupported params here.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { REALTIME_MODEL }            from '@/lib/voice/realtime-config'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: 'OPENAI_API_KEY não configurada no servidor. Acesse Vercel → Settings → Environment Variables e adicione a chave.',
    }, { status: 503 })
  }

  try {
    // Minimal session creation body — only fields the GA sessions endpoint reliably accepts.
    // Full config (instructions, tools, tool_choice, turn_detection) is pushed via
    // session.update message over the DataChannel once WebRTC is established.
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
        'OpenAI-Beta':   'realtime=v1',
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
      console.error('[voice/session] OpenAI error:', res.status, text)

      let friendlyError = `OpenAI ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } }
        if (parsed.error?.message) friendlyError = parsed.error.message
      } catch { /* use raw text */ }

      const hint = res.status === 401
        ? ' — Verifique OPENAI_API_KEY no Vercel (Settings → Environment Variables → Redeploy)'
        : res.status === 403 || friendlyError.includes('beta') || friendlyError.includes('deprecated')
          ? ' — Sua chave pode não ter acesso ao Realtime API. Use uma chave de projeto com acesso ao gpt-4o-realtime-preview.'
          : ''

      return NextResponse.json({
        error:   friendlyError + hint,
        details: text,
        status:  res.status,
      }, { status: 502 })
    }

    const raw = await res.text()
    console.log('[voice/session] OpenAI response:', raw.slice(0, 400))

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(raw) } catch { /* non-JSON */ }

    // Extract ephemeral key from client_secret.value
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
