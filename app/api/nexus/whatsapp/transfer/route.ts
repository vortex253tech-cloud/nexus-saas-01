// POST /api/nexus/whatsapp/transfer
// Body: { conversation_id, note? }
// Transfers conversation to human: sets ai_enabled=false, logs system message

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { createClient }            from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

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

  let body: { conversation_id?: string; note?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { conversation_id, note } = body
  if (!conversation_id) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
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

  // Verify conversation belongs to this company
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, phone')
    .eq('id', conversation_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Disable AI and mark as transferred
  await supabase
    .from('whatsapp_conversations')
    .update({
      ai_enabled:  false,
      status:      'transferred',
      updated_at:  now,
      last_message_at: now,
    })
    .eq('id', conversation_id)

  // Log system message visible in chat
  const systemContent = note
    ? `🔄 Atendimento transferido para humano. Nota: ${note}`
    : '🔄 Atendimento transferido para humano.'

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversation_id,
    company_id:      companyId,
    phone:           conv.phone,
    direction:       'outgoing',
    content:         systemContent,
    from_me:         true,
    ai_generated:    false,
    status:          'sent',
    raw_payload:     { type: 'system', action: 'transfer', note: note ?? null },
  })

  return NextResponse.json({ ok: true })
}
