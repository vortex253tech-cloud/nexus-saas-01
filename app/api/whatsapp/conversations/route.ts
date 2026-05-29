import { NextRequest, NextResponse }   from 'next/server'
import { getSupabaseRouteClient }      from '@/lib/supabase-server'
import { getSupabaseServerClient }     from '@/lib/supabase'
import { getConversations }            from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = await getSupabaseRouteClient()
    const { data: { user }, error } = await supabaseAuth.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

    if (!companyId) {
      const db = getSupabaseServerClient()
      const { data: userRow } = await db
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!userRow) return NextResponse.json({ conversations: [], has_more: false })

      const { data: company } = await db
        .from('companies')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (!company) return NextResponse.json({ conversations: [], has_more: false })

      companyId = company.id
    }

    const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
    const limit  = 30

    const conversations = await getConversations(companyId, limit + 1, cursor)
    const has_more      = conversations.length > limit
    const page          = has_more ? conversations.slice(0, limit) : conversations

    return NextResponse.json({ conversations: page, has_more })
  } catch (err) {
    console.error('[WA conversations] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
