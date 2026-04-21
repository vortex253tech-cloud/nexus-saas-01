import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('[webhook] verification succeeded')
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  console.warn('[webhook] verification rejected', {
    mode,
    hasToken: Boolean(token),
    configured: Boolean(verifyToken),
  })

  return new Response('Forbidden', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    console.log('[webhook] event received', JSON.stringify(body, null, 2))
  } catch (err) {
    console.error('[webhook] failed to parse body', err)
  }

  return NextResponse.json({ status: 'ok' })
}
