// POST /api/nexus/voice/connect
// Creates an ephemeral client secret via the current OpenAI Realtime GA API.
// Endpoint: POST https://api.openai.com/v1/realtime/client_secrets
// (replaces the deprecated /v1/realtime/sessions)
// Returns the raw OpenAI response + _model_used so the browser can open:
//   new WebSocket(wss://api.openai.com/v1/realtime?model=…, [subprotocols])

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

const MODELS = [
  'gpt-realtime',
  'gpt-realtime-mini',
  // legacy fallbacks (kept for accounts that haven't migrated)
  'gpt-4o-realtime-preview',
  'gpt-4o-mini-realtime-preview',
]

function buildBody(model: string) {
  return JSON.stringify({
    session: {
      type:  'realtime',
      model,
      audio: { output: { voice: 'verse' } },
    },
  })
}

async function trySession(key: string, model: string) {
  const body = buildBody(model)
  console.log(`[voice/connect] trying ${model} → ${CLIENT_SECRETS_URL}`)
  console.log(`[voice/connect] body: ${body}`)
  const res = await fetch(CLIENT_SECRETS_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body,
    signal: AbortSignal.timeout(12000),
  })
  return res
}

export async function POST(req: NextRequest) {
  void req

  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada no Vercel. Acesse Settings → Environment Variables.' },
      { status: 503 },
    )
  }

  let lastError = ''

  for (const model of MODELS) {
    try {
      const response = await trySession(key, model)

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>
        // New GA format: { value: "ek_...", expires_at: ..., session: {...} }
        // Wrap into client_secret.value so client.ts can extract the token.
        const tokenValue = (data.value as string | undefined) ?? null
        console.log(`[voice/connect] OK with model ${model}, token: ${tokenValue?.slice(0, 12)}...`)
        return NextResponse.json({
          client_secret: { value: tokenValue, expires_at: data.expires_at ?? null },
          session:        data.session ?? null,
          _model_used:    model,
          model,
        })
      }

      const text = await response.text()
      console.error(`[voice/connect] ${model} → ${response.status}: ${text.slice(0, 200)}`)

      let msg = `OpenAI ${response.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) msg = parsed.error.message
      } catch { /* raw */ }

      if (response.status === 401) {
        return NextResponse.json({
          error: 'API Key inválida (401). Atualize OPENAI_API_KEY no Vercel → Settings → Environment Variables → Redeploy.',
        }, { status: 502 })
      }

      lastError = msg
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed'
      console.error(`[voice/connect] ${model} threw: ${msg}`)
      lastError = msg
    }
  }

  return NextResponse.json({
    error: `Realtime API inacessível. Último erro: ${lastError}`,
  }, { status: 502 })
}
