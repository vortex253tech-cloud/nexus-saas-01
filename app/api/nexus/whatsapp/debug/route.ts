// GET /api/nexus/whatsapp/debug — Diagnose why conversations/messages aren't showing
// Requires auth. Returns counts and config state to trace the full data path.

import { NextResponse }           from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { createClient }           from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 10

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  try {
    const supabaseAuth = await getSupabaseRouteClient()
    const { data: { user }, error } = await supabaseAuth.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = db()

    // 1. Look up user row
    const { data: userRow } = await supabase
      .from('users').select('id').eq('auth_id', user.id).maybeSingle()

    // 2. Look up company
    const { data: company } = userRow
      ? await supabase.from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
      : { data: null }

    const platformCompanyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? null
    // The session's own company is what every other WhatsApp route now uses —
    // this debug endpoint mirrors that so it actually reflects what the user sees.
    const effectiveCompanyId = company?.id ?? null

    // 3. Count conversations
    const { count: convCount } = effectiveCompanyId
      ? await supabase
          .from('whatsapp_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', effectiveCompanyId)
      : { count: 0 }

    // 4. Count messages
    const { count: msgCount } = effectiveCompanyId
      ? await supabase
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', effectiveCompanyId)
      : { count: 0 }

    // 5. Latest conversation
    const { data: latest } = effectiveCompanyId
      ? await supabase
          .from('whatsapp_conversations')
          .select('id, phone, last_message_at, message_count, created_at')
          .eq('company_id', effectiveCompanyId)
          .order('created_at', { ascending: false })
          .limit(3)
      : { data: [] }

    return NextResponse.json({
      ok: true,
      auth_user_id:        user.id,
      user_row_found:      !!userRow,
      user_row_id:         userRow?.id ?? null,
      company_found:       !!company,
      company_id:          company?.id ?? null,
      platform_company_id: platformCompanyId,
      effective_company_id: effectiveCompanyId,
      ids_match:           !platformCompanyId || platformCompanyId === company?.id,
      conversation_count:  convCount ?? 0,
      message_count:       msgCount ?? 0,
      latest_conversations: latest ?? [],
      zapi_configured: !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN),
      openai_configured: !!process.env.OPENAI_API_KEY,
    })
  } catch (err) {
    console.error('[WA debug]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
