// POST /api/nexus/whatsapp/new-conversation
// Body: { phone, message, name? }
// Creates/upserts conversation + sends first message via Z-API

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { createClient }            from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { phone?: string; message?: string; name?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, message, name } = body
  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }

  // Normalize phone — strip non-digits
  const normalizedPhone = phone.replace(/\D/g, '')
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const supabase = db()
  let companyId  = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

  if (!companyId) {
    const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { data: company } = await supabase.from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    companyId = company.id
  }

  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) {
    return NextResponse.json({ error: 'Z-API not configured' }, { status: 503 })
  }

  // Send first message via Z-API
  let zapiData: Record<string, unknown> = {}
  try {
    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
        body:    JSON.stringify({ phone: normalizedPhone, message }),
        signal:  AbortSignal.timeout(25000),
      },
    )
    if (zapiRes.ok) {
      zapiData = await zapiRes.json().catch(() => ({}))
    } else {
      const errBody = await zapiRes.text().catch(() => '')
      console.error('[wa/new-conversation] Z-API error', zapiRes.status, errBody)
      return NextResponse.json({ error: 'Z-API send failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[wa/new-conversation] Z-API error:', String(err))
    return NextResponse.json({ error: 'Z-API unreachable' }, { status: 504 })
  }

  const now = new Date().toISOString()

  // Upsert conversation
  const { data: conv, error: convErr } = await supabase
    .from('whatsapp_conversations')
    .upsert(
      {
        company_id:      companyId,
        phone:           normalizedPhone,
        contact_name:    name ?? normalizedPhone,
        status:          'active',
        ai_enabled:      true,
        last_message_at: now,
        updated_at:      now,
        message_count:   1,
      },
      { onConflict: 'company_id,phone', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (convErr || !conv) {
    console.error('[wa/new-conversation] upsert error:', convErr)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  // Persist outgoing message
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    company_id:      companyId,
    phone:           normalizedPhone,
    direction:       'outgoing',
    content:         message,
    from_me:         true,
    ai_generated:    false,
    status:          'sent',
    raw_payload:     { ...zapiData, type: 'text' },
  })

  return NextResponse.json({ ok: true, conversation_id: conv.id, phone: normalizedPhone })
}
