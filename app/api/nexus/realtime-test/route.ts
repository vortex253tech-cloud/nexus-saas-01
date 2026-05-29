// GET /api/nexus/realtime-test
// Diagnóstico definitivo — testa a key em 3 etapas:
// 1. GET /v1/models — prova que a key é válida
// 2. POST /v1/realtime/sessions (gpt-4o-realtime-preview)
// 3. POST /v1/realtime/sessions (gpt-4o-mini-realtime-preview)
// Retorna request completo + response raw para cada etapa.

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

async function probe(label: string, url: string, init: RequestInit) {
  const start = Date.now()

  // Log exact request details for Vercel Function logs
  console.log(`[realtime-test] ${label}`)
  console.log(`  URL:    ${url}`)
  console.log(`  METHOD: ${init.method ?? 'GET'}`)
  console.log(`  HEADERS:`, JSON.stringify(init.headers ?? {}))
  console.log(`  BODY:   ${init.body ?? 'none'}`)

  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* keep raw text */ }

    console.log(`  RESPONSE STATUS: ${res.status}`)
    console.log(`  RESPONSE BODY:   ${text.slice(0, 300)}`)

    return {
      label,
      ok:      res.ok,
      status:  res.status,
      ms:      Date.now() - start,
      request: {
        url,
        method:  init.method ?? 'GET',
        headers: init.headers ?? {},
        body:    init.body ?? null,
      },
      response: body,
    }
  } catch (err) {
    console.log(`  FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`)
    return {
      label,
      ok:      false,
      status:  0,
      ms:      Date.now() - start,
      request: {
        url,
        method:  init.method ?? 'GET',
        headers: init.headers ?? {},
        body:    init.body ?? null,
      },
      response: { fetch_error: err instanceof Error ? err.message : String(err) },
    }
  }
}

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não definida no ambiente Vercel.' }, { status: 503 })
  }

  const authHeader = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
  const key_hint   = `${key.slice(0, 10)}...${key.slice(-6)}`

  const [step1, step2, step3] = await Promise.all([
    // Step 1: qualquer key válida retorna modelos — se falhar aqui, a key é inválida
    probe('GET /v1/models', 'https://api.openai.com/v1/models', {
      method:  'GET',
      headers: authHeader,
    }),
    // Step 2: realtime preview
    probe('POST /v1/realtime/sessions (gpt-4o-realtime-preview)',
      'https://api.openai.com/v1/realtime/sessions', {
        method:  'POST',
        headers: authHeader,
        body:    JSON.stringify({ model: 'gpt-4o-realtime-preview', modalities: ['audio', 'text'], voice: 'alloy' }),
      }),
    // Step 3: realtime mini (fallback)
    probe('POST /v1/realtime/sessions (gpt-4o-mini-realtime-preview)',
      'https://api.openai.com/v1/realtime/sessions', {
        method:  'POST',
        headers: authHeader,
        body:    JSON.stringify({ model: 'gpt-4o-mini-realtime-preview', modalities: ['audio', 'text'], voice: 'alloy' }),
      }),
  ])

  // Diagnóstico final
  const keyValid    = step1.ok
  const realtimeOk  = step2.ok || step3.ok
  const diagnosis =
    !keyValid   ? 'KEY INVÁLIDA — GET /v1/models falhou. A chave no Vercel está errada ou revogada.' :
    !realtimeOk ? 'KEY VÁLIDA mas sem acesso ao Realtime API — chave não tem Tier 1 com Realtime habilitado.' :
                  'TUDO OK — realtime acessível. Token ephemeral gerado com sucesso.'

  return NextResponse.json({
    key_hint,
    diagnosis,
    step1_models:           step1,
    step2_realtime_preview: step2,
    step3_realtime_mini:    step3,
  }, { status: 200 })
}
