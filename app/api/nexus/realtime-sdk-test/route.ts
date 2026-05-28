// GET /api/nexus/realtime-sdk-test
// Testa o endpoint de sessões usando o SDK OpenAI oficial em vez de raw fetch.
// Se o SDK funcionar e o raw fetch não, há diferença nos headers enviados.

import { NextResponse } from 'next/server'
import OpenAI, { VERSION as OPENAI_VERSION } from 'openai'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY não definida.' }, { status: 503 })

  const key_hint = `${key.slice(0, 10)}...${key.slice(-6)}`

  // ── Teste 1: SDK oficial — beta.realtime.sessions.create ──────────────────
  let sdk_beta_result: unknown = null
  try {
    const client = new OpenAI({ apiKey: key, timeout: 15000 })
    // @ts-expect-error — pode não ter tipagem em todas as versões do SDK
    const session = await client.beta.realtime.sessions.create({
      model:      'gpt-4o-realtime-preview',
      modalities: ['audio', 'text'],
      voice:      'alloy',
    })
    sdk_beta_result = { ok: true, session }
  } catch (e) {
    sdk_beta_result = {
      ok:    false,
      error: e instanceof Error ? e.message : String(e),
      type:  (e as Record<string, unknown>)?.constructor?.name,
      status: (e as Record<string, unknown>)?.status,
    }
  }

  // ── Teste 2: SDK oficial — realtime.sessions.create (sem beta) ────────────
  let sdk_result: unknown = null
  try {
    const client = new OpenAI({ apiKey: key, timeout: 15000 })
    // @ts-expect-error — verificar se existe no path não-beta
    const session = await client.realtime?.sessions?.create?.({
      model:      'gpt-4o-realtime-preview',
      modalities: ['audio', 'text'],
      voice:      'alloy',
    })
    sdk_result = { ok: true, session }
  } catch (e) {
    sdk_result = {
      ok:    false,
      error: e instanceof Error ? e.message : String(e),
      type:  (e as Record<string, unknown>)?.constructor?.name,
      status: (e as Record<string, unknown>)?.status,
    }
  }

  // ── Teste 3: raw fetch mas com User-Agent da SDK OpenAI ───────────────────
  let raw_with_sdk_headers: unknown = null
  try {
    const openaiVersion = OPENAI_VERSION
    const res  = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
        'User-Agent':    `OpenAI/JS ${openaiVersion}`,
        'X-Stainless-Lang': 'js',
        'X-Stainless-Package-Version': openaiVersion,
        'X-Stainless-Runtime': 'node',
        'X-Stainless-Runtime-Version': process.version,
      },
      body:   JSON.stringify({ model: 'gpt-4o-realtime-preview', modalities: ['audio', 'text'], voice: 'alloy' }),
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* raw */ }
    raw_with_sdk_headers = { ok: res.ok, status: res.status, response: body }
  } catch (e) {
    raw_with_sdk_headers = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    key_hint,
    sdk_version: OPENAI_VERSION,
    sdk_beta_realtime_sessions: sdk_beta_result,
    sdk_realtime_sessions:      sdk_result,
    raw_with_sdk_headers,
  })
}
