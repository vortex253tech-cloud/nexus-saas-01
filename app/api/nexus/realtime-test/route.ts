// GET /api/nexus/realtime-test
// Diagnóstico definitivo — testa a key em 3 etapas:
// 1. GET /v1/models — prova que a key é válida
// 2. POST /v1/realtime/client_secrets (gpt-realtime) — endpoint GA atual
// 3. POST /v1/realtime/client_secrets (gpt-realtime-mini) — fallback
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

  const CLIENT_SECRETS = 'https://api.openai.com/v1/realtime/client_secrets'

  const [step1, step2, step3] = await Promise.all([
    // Step 1: qualquer key válida retorna modelos — se falhar aqui, a key é inválida
    probe('GET /v1/models', 'https://api.openai.com/v1/models', {
      method:  'GET',
      headers: authHeader,
    }),
    // Step 2: gpt-realtime (endpoint GA atual)
    probe('POST /v1/realtime/client_secrets (gpt-realtime)',
      CLIENT_SECRETS, {
        method:  'POST',
        headers: authHeader,
        body:    JSON.stringify({ session: { type: 'realtime', model: 'gpt-realtime', audio: { output: { voice: 'verse' } } } }),
      }),
    // Step 3: gpt-realtime-mini (fallback)
    probe('POST /v1/realtime/client_secrets (gpt-realtime-mini)',
      CLIENT_SECRETS, {
        method:  'POST',
        headers: authHeader,
        body:    JSON.stringify({ session: { type: 'realtime', model: 'gpt-realtime-mini', audio: { output: { voice: 'verse' } } } }),
      }),
  ])

  // Diagnóstico final
  const keyValid    = step1.ok
  const realtimeOk  = step2.ok || step3.ok
  const diagnosis =
    !keyValid   ? 'KEY INVÁLIDA — GET /v1/models falhou. A chave no Vercel está errada ou revogada.' :
    !realtimeOk ? 'KEY VÁLIDA mas sem acesso ao Realtime API — verifique permissões da chave ou tier.' :
                  'TUDO OK — realtime acessível via /v1/realtime/client_secrets. Token ephemeral gerado.'

  return NextResponse.json({
    key_hint,
    diagnosis,
    endpoint:               CLIENT_SECRETS,
    step1_models:           step1,
    step2_realtime:         step2,
    step3_realtime_mini:    step3,
  }, { status: 200 })
}
