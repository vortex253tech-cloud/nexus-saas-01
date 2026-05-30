// POST /api/nexus/whatsapp/send — Send a message via Z-API and persist to DB
// Credentials stay server-side. Returns { ok: true } on success.

import { NextRequest, NextResponse }  from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { createClient }              from '@supabase/supabase-js'
import { denyIfCannot }              from '@/lib/plan-middleware'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // ── Plan gate: WhatsApp requires PRO+ ─────────────────────────
  const denied = await denyIfCannot('whatsapp')
  if (denied) return denied

  // ── Auth ──────────────────────────────────────────────────────
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: { phone?: string; message?: string; conversation_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, message, conversation_id } = body
  if (!phone || !message?.trim()) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }
  const text = message.trim()

  // ── Resolve company ───────────────────────────────────────────
  const supabase = db()
  const { data: userRow } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // ── Z-API send ────────────────────────────────────────────────
  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    return NextResponse.json({ error: 'Z-API not configured' }, { status: 503 })
  }

  let zapiData: Record<string, unknown> = {}
  try {
    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
        body:    JSON.stringify({ phone, message: text }),
        signal:  AbortSignal.timeout(10000),
      },
    )
    if (zapiRes.ok) {
      zapiData = await zapiRes.json().catch(() => ({}))
    } else {
      const errBody = await zapiRes.text().catch(() => '')
      console.error('[wa/send] Z-API error', zapiRes.status, errBody)
      return NextResponse.json({ error: 'Z-API send failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[wa/send] Z-API timeout or network error:', String(err))
    return NextResponse.json({ error: 'Z-API unreachable' }, { status: 504 })
  }

  // ── Resolve conversation ──────────────────────────────────────
  let convId = conversation_id ?? null
  if (!convId) {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', company.id)
      .eq('phone', phone)
      .maybeSingle()
    convId = conv?.id ?? null
  }

  // ── Persist outgoing message ──────────────────────────────────
  if (convId) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: convId,
      company_id:      company.id,
      phone,
      direction:       'outgoing',
      content:         text,
      from_me:         true,
      ai_generated:    false,
      status:          'sent',
      raw_payload:     zapiData,
      zapi_message_id: (zapiData.zaapId ?? zapiData.messageId ?? null) as string | null,
    })

    // Update conversation timestamp
    await supabase
      .from('whatsapp_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)
  }

  return NextResponse.json({ ok: true })
}
