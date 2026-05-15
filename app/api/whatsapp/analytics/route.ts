import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAnalytics }            from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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

    if (!userRow) return NextResponse.json({ analytics: [] })

    const { data: company } = await db
      .from('companies')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (!company) return NextResponse.json({ analytics: [] })

    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)
    const analytics = await getAnalytics(company.id, days)
    return NextResponse.json({ analytics })
  } catch (err) {
    console.error('[WA analytics]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
