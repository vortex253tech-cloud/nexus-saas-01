// GET /api/nexus/realtime-debug
// Diagnóstico profundo: extrai modelos realtime disponíveis e testa o endpoint GA atual.
// Endpoint GA: POST /v1/realtime/client_secrets (substituiu /v1/realtime/sessions)

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 25

const CLIENT_SECRETS = 'https://api.openai.com/v1/realtime/client_secrets'

async function call(label: string, url: string, init: RequestInit) {
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* raw */ }
    return { label, ok: res.ok, status: res.status,
      request: { url, method: init.method, headers: init.headers, body: init.body ?? null },
      response: body }
  } catch (e) {
    return { label, ok: false, status: 0,
      request: { url, method: init.method, body: init.body ?? null },
      response: { fetch_error: e instanceof Error ? e.message : String(e) } }
  }
}

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY não definida.' }, { status: 503 })

  const auth = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
  const key_hint = `${key.slice(0, 10)}...${key.slice(-6)}`

  // ── 1. Lista modelos e filtra todos que contêm "realtime" no ID ───────────
  const modelsRes  = await call('GET /v1/models', 'https://api.openai.com/v1/models', { method: 'GET', headers: auth })
  const modelsBody = modelsRes.response as { data?: { id: string }[] } | undefined
  const realtimeModels = (modelsBody?.data ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id: string) => id.includes('realtime') || id.includes('real-time'))

  // ── 2. Testa o endpoint GA atual com variações de modelo ──────────────────
  const variants = [
    'gpt-realtime',
    'gpt-realtime-mini',
    // legacy (podem não funcionar mais)
    ...realtimeModels.filter((m: string) => m.includes('preview')).slice(0, 2),
  ]

  function sessionBody(model: string) {
    return JSON.stringify({ session: { type: 'realtime', model, audio: { output: { voice: 'verse' } } } })
  }

  const sessionTests = await Promise.all(
    [...new Set(variants)].map(model =>
      call(`POST client_secrets — ${model}`, CLIENT_SECRETS, {
        method:  'POST',
        headers: auth,
        body:    sessionBody(model),
      })
    )
  )

  // ── 3. Testa body mínimo (sem audio) ──────────────────────────────────────
  const sessionMinimal = await call('POST client_secrets — body mínimo (sem audio)', CLIENT_SECRETS, {
    method:  'POST',
    headers: auth,
    body:    JSON.stringify({ session: { type: 'realtime', model: 'gpt-realtime' } }),
  })

  // ── 4. Testa sem Content-Type ─────────────────────────────────────────────
  const sessionNoContentType = await call('POST client_secrets — sem Content-Type', CLIENT_SECRETS, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}` },
    body:    sessionBody('gpt-realtime'),
  })

  const anySessionOk = sessionTests.some(t => t.ok) || sessionMinimal.ok

  return NextResponse.json({
    key_hint,
    endpoint:                               CLIENT_SECRETS,
    realtime_models_available_for_this_key: realtimeModels,
    realtime_accessible:                    anySessionOk,
    session_variants:                       sessionTests,
    session_minimal:                        sessionMinimal,
    session_without_content_type:           sessionNoContentType,
  }, { status: 200 })
}
