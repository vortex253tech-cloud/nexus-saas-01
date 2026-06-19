// GET|POST /api/cron/voice-health — Vercel cron: daily health-check for NEXUS OS voice
// Vercel sends Authorization: Bearer <CRON_SECRET>
//
// The OpenAI Realtime API has changed session/event formats without notice
// before (~25 fix commits in 2 days — see docs/decisoes.md). This mints a
// real ephemeral token and opens/closes a real WebSocket connection, the
// same way lib/nexus/voice-engine.ts does in the browser, so a break shows
// up here before a user reports it manually.

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'
const MODEL              = 'gpt-realtime'
const CONNECT_TIMEOUT_MS = 10000

interface MintResult { token: string; model: string }

async function mintEphemeralToken(): Promise<MintResult | { error: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { error: 'OPENAI_API_KEY não configurada' }

  try {
    const res = await fetch(CLIENT_SECRETS_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session: { type: 'realtime', model: MODEL, audio: { output: { voice: 'verse' } } } }),
      signal:  AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: `OpenAI ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json() as { value?: string; session?: { model?: string } }
    if (!data.value) return { error: 'Token vazio retornado pela OpenAI' }

    return { token: data.value, model: data.session?.model ?? MODEL }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'fetch failed' }
  }
}

async function testRealtimeConnection(): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  const minted = await mintEphemeralToken()
  if ('error' in minted) return { ok: false, error: minted.error }

  const t0 = Date.now()

  return new Promise(resolve => {
    let settled = false
    const finish = (result: { ok: true; ms: number } | { ok: false; error: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      resolve(result)
    }

    const timer = setTimeout(() => finish({ ok: false, error: `Timeout aguardando handshake (${CONNECT_TIMEOUT_MS}ms)` }), CONNECT_TIMEOUT_MS)

    let ws: WebSocket
    try {
      ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(minted.model)}`,
        ['realtime', `openai-insecure-api-key.${minted.token}`],
      )
    } catch (err) {
      clearTimeout(timer)
      resolve({ ok: false, error: `WebSocket indisponível neste runtime: ${err instanceof Error ? err.message : String(err)}` })
      return
    }

    // First server-sent event (normally session.created) proves the
    // handshake and the event format are both still working.
    ws.addEventListener('message', () => finish({ ok: true, ms: Date.now() - t0 }))
    ws.addEventListener('error',   () => finish({ ok: false, error: 'WebSocket error ao conectar' }))
    ws.addEventListener('close',   (ev) => {
      if (!settled) finish({ ok: false, error: `Conexão fechada antes do handshake (code ${ev.code})` })
    })
  })
}

async function alertFailure(error: string) {
  const to = process.env.VOICE_HEALTH_ALERT_EMAIL ?? 'vortex253tech@gmail.com'
  try {
    await sendEmail({
      to,
      subject: '🔴 NEXUS OS — voz (Realtime API) fora do ar',
      html: `
        <p>O health-check automático da integração de voz (NEXUS OS) falhou.</p>
        <p><strong>Erro:</strong> ${error}</p>
        <p>Verifique <code>/dashboard/system/realtime</code> e a chave <code>OPENAI_API_KEY</code> na Vercel.</p>
      `,
    })
  } catch (err) {
    console.error('[voice-health] failed to send alert email:', err)
  }
}

async function handler(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await testRealtimeConnection()

  if (!result.ok) {
    console.error('[voice-health] FAILED:', result.error)
    await alertFailure(result.error)
    return NextResponse.json({ ok: false, error: result.error })
  }

  console.log(`[voice-health] OK (${result.ms}ms)`)
  return NextResponse.json({ ok: true, ms: result.ms })
}

export const GET  = handler
export const POST = handler
