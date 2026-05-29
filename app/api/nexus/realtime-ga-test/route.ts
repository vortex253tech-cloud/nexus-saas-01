// GET /api/nexus/realtime-ga-test
// Tests the CURRENT OpenAI Realtime GA API endpoint:
//   POST https://api.openai.com/v1/realtime/client_secrets
// (The old /v1/realtime/sessions returns 404 — this is the replacement)

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

interface Attempt {
  label: string
  body:  Record<string, unknown>
}

const ATTEMPTS: Attempt[] = [
  {
    label: 'gpt-realtime / full session body',
    body:  { session: { type: 'realtime', model: 'gpt-realtime', audio: { output: { voice: 'verse' } } } },
  },
  {
    label: 'gpt-realtime / minimal',
    body:  { session: { model: 'gpt-realtime' } },
  },
  {
    label: 'gpt-realtime-mini / full session body',
    body:  { session: { type: 'realtime', model: 'gpt-realtime-mini', audio: { output: { voice: 'verse' } } } },
  },
  {
    label: 'gpt-realtime / voice=cedar',
    body:  { session: { type: 'realtime', model: 'gpt-realtime', audio: { output: { voice: 'cedar' } } } },
  },
  {
    label: 'gpt-realtime / voice=alloy',
    body:  { session: { type: 'realtime', model: 'gpt-realtime', audio: { output: { voice: 'alloy' } } } },
  },
  {
    label: 'gpt-realtime / flat body (old format for new model)',
    body:  { model: 'gpt-realtime', modalities: ['audio', 'text'], voice: 'verse' },
  },
]

async function attempt(key: string, a: Attempt) {
  const bodyStr = JSON.stringify(a.body)
  const headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }

  console.log(`[realtime-ga-test] ${a.label}`)
  console.log(`  BODY: ${bodyStr}`)

  try {
    const res  = await fetch(CLIENT_SECRETS_URL, {
      method: 'POST', headers, body: bodyStr,
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* raw */ }

    console.log(`  STATUS: ${res.status} — ${text.slice(0, 150)}`)

    return { label: a.label, ok: res.ok, status: res.status, request_body: a.body, response: body }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { label: a.label, ok: false, status: 0, request_body: a.body, response: { fetch_error: msg } }
  }
}

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY não definida.' }, { status: 503 })

  const key_hint = `${key.slice(0, 10)}...${key.slice(-6)}`
  const results  = await Promise.all(ATTEMPTS.map(a => attempt(key, a)))
  const first_ok = results.find(r => r.ok)

  return NextResponse.json({
    key_hint,
    endpoint:      CLIENT_SECRETS_URL,
    first_success: first_ok ? first_ok.label : null,
    results,
  })
}
