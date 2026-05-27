// POST /api/nexus/voice/connect
// Proxies the WebRTC SDP handshake with OpenAI Realtime API completely server-side.
// Browser sends SDP offer → this route → OpenAI /v1/realtime → SDP answer → browser.
// No ephemeral tokens needed — API key never leaves the server.
// The actual WebRTC audio/data streams still go directly browser ↔ OpenAI (P2P).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { REALTIME_MODEL }            from '@/lib/voice/realtime-config'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
  }

  let sdpOffer: string
  try {
    sdpOffer = await req.text()
    if (!sdpOffer || !sdpOffer.startsWith('v=')) {
      return NextResponse.json({ error: 'Invalid SDP offer' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read SDP offer' }, { status: 400 })
  }

  try {
    console.log('[voice/connect] SDP exchange → OpenAI, model:', REALTIME_MODEL)

    const res = await fetch(`https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/sdp',
      },
      body:   sdpOffer,
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[voice/connect] OpenAI error:', res.status, text.slice(0, 600))

      let friendlyError = `OpenAI SDP ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) friendlyError = parsed.error.message
      } catch {
        if (text) friendlyError = `OpenAI ${res.status}: ${text.slice(0, 250)}`
      }

      return NextResponse.json({ error: friendlyError }, { status: 502 })
    }

    const sdpAnswer = await res.text()
    console.log('[voice/connect] SDP answer received, bytes:', sdpAnswer.length)

    return new NextResponse(sdpAnswer, {
      status:  200,
      headers: { 'Content-Type': 'application/sdp' },
    })
  } catch (err) {
    console.error('[voice/connect] error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Server error',
    }, { status: 500 })
  }
}
