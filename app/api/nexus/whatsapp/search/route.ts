// GET /api/nexus/whatsapp/search?q=termo
// Global search: contacts (name, phone, email, tags) + message content.
// Returns up to 20 conversations with a matched_message preview if the hit is in a message.

import { NextRequest, NextResponse }   from 'next/server'
import { getSupabaseRouteClient }      from '@/lib/supabase-server'
import { getSupabaseServerClient }     from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ results: [] })

  // Auth
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve company
  let companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''
  if (!companyId) {
    const db = getSupabaseServerClient()
    const { data: userRow } = await db.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!userRow) return NextResponse.json({ results: [] })
    const { data: company } = await db.from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
    if (!company) return NextResponse.json({ results: [] })
    companyId = company.id
  }

  const db = getSupabaseServerClient()
  const like = `%${q}%`

  // 1. Search contacts by name / phone / email / tag
  const { data: convMatches } = await db
    .from('whatsapp_conversations')
    .select('id, phone, contact_name, photo_url, status, ai_enabled, last_message_at, message_count, unread_count, pipeline_stage, estimated_value, tags, label:metadata->label, temperatura:metadata->temperatura')
    .eq('company_id', companyId)
    .or(`contact_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    .order('last_message_at', { ascending: false })
    .limit(20)

  // 2. Search message content (separate query)
  const { data: msgMatches } = await db
    .from('whatsapp_messages')
    .select('conversation_id, content, created_at')
    .eq('company_id', companyId)
    .ilike('content', like)
    .order('created_at', { ascending: false })
    .limit(30)

  // Collect conv IDs from message matches, dedup
  const convIdsFromMsgs = [...new Set((msgMatches ?? []).map(m => m.conversation_id))]

  // Fetch conversations for message hits (if not already in convMatches)
  const existingIds = new Set((convMatches ?? []).map(c => c.id))
  const extraIds = convIdsFromMsgs.filter(id => !existingIds.has(id)).slice(0, 10)

  let extraConvs: typeof convMatches = []
  if (extraIds.length > 0) {
    const { data } = await db
      .from('whatsapp_conversations')
      .select('id, phone, contact_name, photo_url, status, ai_enabled, last_message_at, message_count, unread_count, pipeline_stage, estimated_value, tags, label:metadata->label, temperatura:metadata->temperatura')
      .in('id', extraIds)
    extraConvs = data ?? []
  }

  // Build matched_message map
  const msgMap = new Map<string, string>()
  for (const m of msgMatches ?? []) {
    if (!msgMap.has(m.conversation_id)) {
      const snip = m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content
      msgMap.set(m.conversation_id, snip)
    }
  }

  const all = [...(convMatches ?? []), ...extraConvs]

  const results = all.slice(0, 20).map(c => ({
    id:              c.id,
    phone:           c.phone,
    contact_name:    c.contact_name,
    photo_url:       c.photo_url,
    status:          c.status,
    ai_enabled:      c.ai_enabled,
    last_message_at: c.last_message_at,
    message_count:   c.message_count,
    unread_count:    c.unread_count ?? 0,
    pipeline_stage:  c.pipeline_stage,
    estimated_value: c.estimated_value,
    tags:            c.tags ?? [],
    matched_message: msgMap.get(c.id) ?? null,
  }))

  return NextResponse.json({ results, query: q })
}
