import { NextResponse }         from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { getSupabaseServerClient }from '@/lib/supabase'
import { getConversations }       from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseAuth = await getSupabaseRouteClient()
    const { data: { user }, error } = await supabaseAuth.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseServerClient()
    const { data: userRow } = await db
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!userRow) return NextResponse.json({ conversations: [] })

    const { data: company } = await db
      .from('companies')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (!company) return NextResponse.json({ conversations: [] })

    const conversations = await getConversations(company.id)
    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[WA conversations]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
