// POST /api/nexus/voice/connect
// Creates an ephemeral OpenAI Realtime session (GA API).
// Returns { client_secret: { value }, model } — browser uses client_secret.value
// to open: new WebSocket(wss://api.openai.com/v1/realtime?model=…, [subprotocols])

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

const MODELS = [
  'gpt-4o-realtime-preview',
  'gpt-4o-mini-realtime-preview',
]

async function trySession(key: string, model: string) {
  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body:   JSON.stringify({
      model,
      modalities: ['audio', 'text'],
      voice:      'alloy',
    }),
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
        console.log(`[voice/connect] OK with model ${model}`)
        return NextResponse.json({ ...data, _model_used: model })
      }

      const text = await response.text()
      console.error(`[voice/connect] ${model} → ${response.status}:`, text.slice(0, 200))

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
      // 404 = model not accessible — try next model
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed'
      console.error(`[voice/connect] ${model} threw:`, msg)
      lastError = msg
    }
  }

  // All models failed
  return NextResponse.json({
    error: `Realtime API inacessível com esta chave OpenAI. Verifique se a chave em Vercel → OPENAI_API_KEY pertence à organização com Realtime access (Tier 1+). Último erro: ${lastError}`,
  }, { status: 502 })
}
