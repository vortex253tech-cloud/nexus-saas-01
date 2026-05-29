// GET /api/nexus/realtime-ga-test
// Tests the CURRENT OpenAI Realtime GA API with all known model variants
// including gpt-realtime and gpt-realtime-mini (newer models visible in /v1/models).
// Each attempt shows exact URL, headers, body, and response.

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const SESSION_URL = 'https://api.openai.com/v1/realtime/sessions'

interface Attempt {
  label:    string
  model:    string
  body:     Record<string, unknown>
  extra_headers?: Record<string, string>
}

const ATTEMPTS: Attempt[] = [
  // New model family (visible in /v1/models for this account)
  { label: 'gpt-realtime / full body',      model: 'gpt-realtime',      body: { model: 'gpt-realtime',      modalities: ['audio', 'text'], voice: 'alloy' } },
  { label: 'gpt-realtime / minimal',        model: 'gpt-realtime',      body: { model: 'gpt-realtime' } },
  { label: 'gpt-realtime-mini / full body', model: 'gpt-realtime-mini', body: { model: 'gpt-realtime-mini', modalities: ['audio', 'text'], voice: 'alloy' } },
  { label: 'gpt-realtime-mini / minimal',   model: 'gpt-realtime-mini', body: { model: 'gpt-realtime-mini' } },
  // Old model family (was failing with 404 — kept for comparison)
  { label: 'gpt-4o-realtime-preview / full',  model: 'gpt-4o-realtime-preview',       body: { model: 'gpt-4o-realtime-preview',       modalities: ['audio', 'text'], voice: 'alloy' } },
  { label: 'gpt-4o-mini-realtime-preview',    model: 'gpt-4o-mini-realtime-preview',  body: { model: 'gpt-4o-mini-realtime-preview',  modalities: ['audio', 'text'], voice: 'alloy' } },
  // Try without modalities field entirely
  { label: 'gpt-realtime / no modalities',  model: 'gpt-realtime', body: { model: 'gpt-realtime', voice: 'alloy' } },
  // Try with different voice
  { label: 'gpt-realtime / voice=verse',    model: 'gpt-realtime', body: { model: 'gpt-realtime', modalities: ['audio', 'text'], voice: 'verse' } },
]

async function attempt(key: string, a: Attempt) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
    ...( a.extra_headers ?? {} ),
  }
  const bodyStr = JSON.stringify(a.body)

  console.log(`[realtime-ga-test] ${a.label}`)
  console.log(`  URL:     ${SESSION_URL}`)
  console.log(`  HEADERS: ${JSON.stringify(headers)}`)
  console.log(`  BODY:    ${bodyStr}`)

  try {
    const res  = await fetch(SESSION_URL, {
      method:  'POST',
      headers,
      body:    bodyStr,
      signal:  AbortSignal.timeout(10000),
    })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* raw */ }

    console.log(`  STATUS:  ${res.status}`)
    console.log(`  RESP:    ${text.slice(0, 200)}`)

    return {
      label:    a.label,
      ok:       res.ok,
      status:   res.status,
      request:  { url: SESSION_URL, method: 'POST', headers, body: a.body },
      response: body,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ERROR:   ${msg}`)
    return {
      label:    a.label,
      ok:       false,
      status:   0,
      request:  { url: SESSION_URL, method: 'POST', headers, body: a.body },
      response: { fetch_error: msg },
    }
  }
}

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY não definida.' }, { status: 503 })

  const key_hint = `${key.slice(0, 10)}...${key.slice(-6)}`

  const results = await Promise.all(ATTEMPTS.map(a => attempt(key, a)))

  const first_ok = results.find(r => r.ok)

  return NextResponse.json({
    key_hint,
    session_url: SESSION_URL,
    first_success: first_ok ? first_ok.label : null,
    results,
  })
}
