// GET /api/nexus/realtime-debug
// Diagnóstico profundo: extrai modelos realtime disponíveis e testa variações do endpoint.

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 25

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

  // ── 2. Testa o endpoint com variações de modelo ────────────────────────────
  const SESSION = 'https://api.openai.com/v1/realtime/sessions'
  const variants = [
    'gpt-4o-realtime-preview',
    'gpt-4o-realtime-preview-2024-12-17',
    'gpt-4o-mini-realtime-preview',
    'gpt-4o-mini-realtime-preview-2024-12-17',
    // versões potencialmente novas em 2025
    ...realtimeModels.filter((m: string) => !m.includes('mini')).slice(0, 2),
  ]

  const sessionTests = await Promise.all(
    [...new Set(variants)].map(model =>
      call(`POST sessions — ${model}`, SESSION, {
        method:  'POST',
        headers: auth,
        body:    JSON.stringify({ model, modalities: ['audio', 'text'], voice: 'alloy' }),
      })
    )
  )

  // ── 3. Testa sem modalities (body mínimo) ─────────────────────────────────
  const sessionMinimal = await call('POST sessions — body mínimo (gpt-4o-realtime-preview)', SESSION, {
    method:  'POST',
    headers: auth,
    body:    JSON.stringify({ model: 'gpt-4o-realtime-preview' }),
  })

  // ── 4. Testa com header OpenAI-Organization (se organização disponível) ────
  // Alguns endpoints exigem org ID
  const sessionWithOrg = await call('POST sessions — sem Content-Type', SESSION, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify({ model: 'gpt-4o-realtime-preview', modalities: ['audio', 'text'], voice: 'alloy' }),
  })

  const anySessionOk = sessionTests.some(t => t.ok) || sessionMinimal.ok || sessionWithOrg.ok

  return NextResponse.json({
    key_hint,
    realtime_models_available_for_this_key: realtimeModels,
    realtime_accessible: anySessionOk,
    session_variants:    sessionTests,
    session_minimal:     sessionMinimal,
    session_without_content_type: sessionWithOrg,
  }, { status: 200 })
}
