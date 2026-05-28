// GET /api/nexus/voice/health
// Deep health check: confirms OPENAI_API_KEY is set AND tests real connectivity
// to /v1/realtime/sessions. Returns clear diagnosis for any failure.

import { NextResponse } from 'next/server'
import { REALTIME_MODEL } from '@/lib/voice/realtime-config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const key = process.env.OPENAI_API_KEY

  if (!key) {
    return NextResponse.json(
      {
        success:   false,
        stage:     'env',
        error:     'OPENAI_API_KEY não está configurada no Vercel.',
        fix:       'Acesse Vercel → Settings → Environment Variables → adicione OPENAI_API_KEY → Redeploy.',
      },
      { status: 503 },
    )
  }

  const key_hint = `${key.slice(0, 7)}...${key.slice(-4)}`

  // Test real connectivity: call /v1/realtime/sessions (same call the session route makes)
  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify({ model: REALTIME_MODEL, modalities: ['audio', 'text'], voice: 'alloy' }),
      signal: AbortSignal.timeout(10000),
    })

    const text = await res.text()
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(text) as Record<string, unknown> } catch { /* raw */ }

    if (!res.ok) {
      const errMsg = (body as { error?: { message?: string } }).error?.message ?? text.slice(0, 300)
      return NextResponse.json(
        {
          success:   false,
          stage:     'openai',
          status:    res.status,
          error:     errMsg,
          key_hint,
          fix:
            res.status === 401
              ? 'API Key inválida ou expirada. Vá em platform.openai.com → API Keys → crie uma nova chave → atualize no Vercel → Redeploy.'
              : res.status === 403
              ? 'API Key sem permissão. Verifique se a organização tem acesso ao gpt-4o-realtime-preview.'
              : res.status === 404
              ? 'ACESSO AO REALTIME API NEGADO (404). Sua chave não tem acesso ao gpt-4o-realtime-preview. Necessário: (1) OpenAI Tier 1+ — use $5 de crédito OU aguarde 30 dias com billing ativo. (2) Verifique em platform.openai.com → Settings → Limits → Usage tier.'
              : 'Verifique a API Key no Vercel e confirme que tem billing ativo no OpenAI.',
        },
        { status: 502 },
      )
    }

    // Success — realtime API is fully accessible
    return NextResponse.json({
      success:   true,
      realtime:  'online',
      websocket: 'ready',
      model:     REALTIME_MODEL,
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
