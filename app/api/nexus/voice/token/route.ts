// POST /api/nexus/voice/token
// Cria ephemeral token para OpenAI Realtime GA.
// Retorna { token, model, expires_at } — NexusVoiceEngine usa token nos subprotocols WebSocket.

import { NextRequest, NextResponse }   from 'next/server'
import { createClient }                from '@supabase/supabase-js'
import { getSupabaseRouteClient }      from '@/lib/supabase-server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

const MODELS = [
  'gpt-4o-realtime-preview',
  'gpt-4o-mini-realtime-preview',
]

export async function POST(req: NextRequest) {
  // Support both cookie auth (browser) and Bearer token auth (API clients/testing)
  const authHeader = req.headers.get('authorization')
  let user = null

  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.slice(7)
    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    // createClient from supabase-js correctly sets Authorization header for auth calls
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    })
    const { data, error: e } = await client.auth.getUser()
    if (e || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    user = data.user
  } else {
    const supabase = await getSupabaseRouteClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    user = data.user
  }
  void user // validated

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada. Acesse Vercel → Settings → Environment Variables.' },
      { status: 503 },
    )
  }

  let lastError = 'Nenhum modelo disponível'

  for (const model of MODELS) {
    try {
      const body = JSON.stringify({
        session: {
          type:  'realtime',
          model,
          audio: { output: { voice: 'verse' } },
        },
      })

      console.log(`[nexus/token] tentando model=${model}`)

      const res = await fetch(CLIENT_SECRETS_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
        },
        body,
        signal: AbortSignal.timeout(12000),
      })

      if (res.ok) {
        // GA format: { value: "ek_...", expires_at: ..., session: { model: "...", ... } }
        const data = await res.json() as { value?: string; expires_at?: number; session?: { model?: string } }
        const token      = data.value ?? null
        // Use the actual model from the response so the client opens WS with the right model
        const actualModel = (data.session as { model?: string } | undefined)?.model ?? model
        console.log(`[nexus/token] OK model=${model} actual=${actualModel} token=${token?.slice(0, 12) ?? 'NULL'}...`)
        if (!token) return NextResponse.json({ error: 'Token vazio retornado pela OpenAI' }, { status: 502 })
        return NextResponse.json({ token, model: actualModel, expires_at: data.expires_at ?? null })
      }

      const text = await res.text()
      let msg = `OpenAI ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } }
        if (parsed.error?.message) msg = parsed.error.message
      } catch { /* raw text */ }

      console.error(`[nexus/token] ${model} → ${res.status}: ${text.slice(0, 200)}`)

      if (res.status === 401) {
        return NextResponse.json({
          error: 'API Key inválida (401). Atualize OPENAI_API_KEY no Vercel → Settings → Environment Variables → Redeploy.',
        }, { status: 502 })
      }

      lastError = msg
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'fetch failed'
      console.error(`[nexus/token] ${model} threw: ${lastError}`)
    }
  }

  return NextResponse.json({
    error: `Realtime API inacessível. Último erro: ${lastError}`,
  }, { status: 502 })
}
