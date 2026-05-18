// POST /api/nexus/whatsapp/send-image
// Receives { phone, image (base64 data-url or raw base64), caption, conversation_id }
// Sends via Z-API and persists to DB

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

  let body: { phone?: string; image?: string; caption?: string; conversation_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, image, caption = '', conversation_id } = body
  if (!phone || !image) {
    return NextResponse.json({ error: 'phone and image required' }, { status: 400 })
  }

  // Strip data-url prefix if present (data:image/jpeg;base64,...)
  const base64 = image.includes(',') ? image.split(',')[1] : image

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

  // Send image via Z-API
  let zapiData: Record<string, unknown> = {}
  try {
    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' },
        body:    JSON.stringify({ phone, image: base64, caption }),
        signal:  AbortSignal.timeout(25000),
      },
    )
    if (zapiRes.ok) {
      zapiData = await zapiRes.json().catch(() => ({}))
    } else {
      const errBody = await zapiRes.text().catch(() => '')
      console.error('[wa/send-image] Z-API error', zapiRes.status, errBody)
      return NextResponse.json({ error: 'Z-API send failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[wa/send-image] Z-API error:', String(err))
    return NextResponse.json({ error: 'Z-API unreachable' }, { status: 504 })
  }

  // Resolve conversation
  let convId = conversation_id ?? null
  if (!convId) {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone', phone)
      .maybeSingle()
    convId = conv?.id ?? null
  }

  // Persist message
  if (convId) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: convId,
      company_id:      companyId,
      phone,
      direction:       'outgoing',
      content:         caption || '📷 Imagem',
      from_me:         true,
      ai_generated:    false,
      status:          'sent',
      raw_payload:     { ...zapiData, type: 'image' },
    })
    await supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', convId)
  }

  return NextResponse.json({ ok: true })
}
