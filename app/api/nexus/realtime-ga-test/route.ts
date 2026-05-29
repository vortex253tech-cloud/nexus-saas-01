// GET /api/nexus/realtime-ga-test
// Validates the full token extraction flow without auth.
// Simulates exactly what voice/connect does and verifies client.ts can extract the token.

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY não definida.' }, { status: 503 })

  const key_hint = `${key.slice(0, 10)}...${key.slice(-6)}`

  // ── Step 1: Call OpenAI exactly like voice/connect does ──────────────────
  let raw: Record<string, unknown> = {}
  let openai_status = 0
  let openai_ok = false

  try {
    const res = await fetch(CLIENT_SECRETS_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session: { type: 'realtime', model: 'gpt-realtime', audio: { output: { voice: 'verse' } } } }),
      signal:  AbortSignal.timeout(10000),
    })
    openai_status = res.status
    openai_ok     = res.ok
    const text    = await res.text()
    try { raw = JSON.parse(text) as Record<string, unknown> } catch { raw = { raw_text: text } }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  if (!openai_ok) {
    return NextResponse.json({ error: 'OpenAI returned non-200', openai_status, raw }, { status: 502 })
  }

  // ── Step 2: voice/connect wraps the response ─────────────────────────────
  // This is EXACTLY what voice/connect/route.ts now does:
  const tokenValue = (raw.value as string | undefined) ?? null
  const wrapped = {
    client_secret: { value: tokenValue, expires_at: raw.expires_at ?? null },
    session:        raw.session ?? null,
    _model_used:    'gpt-realtime',
    model:          'gpt-realtime',
  }

  // ── Step 3: client.ts token extraction ───────────────────────────────────
  // This is EXACTLY what client.ts does on line 151:
  const data = wrapped as {
    client_secret?: { value?: string }
    ephemeral_key?: string
    value?:         string
    error?:         string
  }
  const token = data.client_secret?.value ?? data.ephemeral_key ?? (data as Record<string, unknown>).value as string ?? null

  const extraction_ok = typeof token === 'string' && token.startsWith('ek_')

  return NextResponse.json({
    key_hint,
    openai_status,
    openai_raw_keys:     Object.keys(raw),
    openai_raw_value:    typeof raw.value === 'string' ? `${raw.value.slice(0, 15)}...` : null,

    wrapped_response:    {
      'client_secret.value': wrapped.client_secret.value
        ? `${String(wrapped.client_secret.value).slice(0, 15)}...`
        : null,
      _model_used: wrapped._model_used,
    },

    client_ts_extraction: {
      token_found:     extraction_ok,
      token_preview:   token ? `${token.slice(0, 15)}...` : 'NULL',
      token_starts_ek: token?.startsWith('ek_') ?? false,
    },

    websocket_will_connect: extraction_ok,
    diagnosis: extraction_ok
      ? '✅ TOKEN EXTRAÍDO — WebSocket conectará. Microfone funcionará.'
      : '❌ TOKEN NÃO ENCONTRADO — verificar resposta OpenAI.',
  })
}
