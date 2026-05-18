import { NextResponse }         from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { getSupabaseServerClient }from '@/lib/supabase'
import { getConversations }       from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Auth — must be logged in
    const supabaseAuth = await getSupabaseRouteClient()
    const { data: { user }, error } = await supabaseAuth.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve company_id:
    // 1. Prefer NEXUS_PLATFORM_COMPANY_ID (single-tenant — matches what the webhook uses)
    // 2. Fall back to auth-derived company from the DB
    let companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

    if (!companyId) {
      const db = getSupabaseServerClient()
      const { data: userRow } = await db
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!userRow) {
        console.warn('[WA conversations] No user row for auth_id:', user.id)
        return NextResponse.json({ conversations: [] })
      }

      const { data: company } = await db
        .from('companies')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (!company) {
        console.warn('[WA conversations] No company for user_id:', userRow.id)
        return NextResponse.json({ conversations: [] })
      }

      companyId = company.id
    }

    console.log('[WA conversations] fetching for company:', companyId)
    const conversations = await getConversations(companyId)
    console.log('[WA conversations] found:', conversations.length)
    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[WA conversations] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
