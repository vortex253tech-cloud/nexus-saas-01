// GET /api/nexus/voice/health
// Deep health check: confirms OPENAI_API_KEY is set AND tests real connectivity
// using the current GA endpoint: POST /v1/realtime/client_secrets

import { NextResponse } from 'next/server'
import { REALTIME_MODEL } from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export async function GET() {
  const key = process.env.OPENAI_API_KEY

  if (!key) {
    return NextResponse.json(
      {
        success: false,
        stage:   'env',
        error:   'OPENAI_API_KEY não está configurada no Vercel.',
        fix:     'Acesse Vercel → Settings → Environment Variables → adicione OPENAI_API_KEY → Redeploy.',
      },
      { status: 503 },
    )
  }

  const key_hint = `${key.slice(0, 7)}...${key.slice(-4)}`

  try {
    const res = await fetch(CLIENT_SECRETS_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        session: {
          type:  'realtime',
          model: REALTIME_MODEL,
          audio: { output: { voice: 'verse' } },
        },
      }),
      signal: AbortSignal.timeout(10000),
    })

    const text = await res.text()
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(text) as Record<string, unknown> } catch { /* raw */ }

    if (!res.ok) {
      const errMsg = (body as { error?: { message?: string } }).error?.message ?? text.slice(0, 300)
      return NextResponse.json(
        {
          success:  false,
          stage:    'openai',
          status:   res.status,
          error:    errMsg,
          key_hint,
          endpoint: CLIENT_SECRETS_URL,
          fix:
            res.status === 401
              ? 'API Key inválida ou expirada.'
              : res.status === 403
              ? 'API Key sem permissão para Realtime.'
              : `Erro ${res.status} do OpenAI.`,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success:   true,
      realtime:  'online',
      websocket: 'ready',
      model:     REALTIME_MODEL,
      endpoint:  CLIENT_SECRETS_URL,
      key_hint,
    })

  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        stage:   'network',
        error:   err instanceof Error ? err.message : 'Network error reaching OpenAI',
        key_hint,
        fix:     'Verifique a conectividade de rede do Vercel com api.openai.com.',
      },
      { status: 503 },
    )
  }
}
