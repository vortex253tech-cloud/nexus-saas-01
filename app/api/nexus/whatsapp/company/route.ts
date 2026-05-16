// GET /api/nexus/whatsapp/company — Return company_id for client-side Realtime subscriptions
// Safe: only returns the user's own company_id via session auth

import { NextResponse }           from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { createClient }           from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 5

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
    if (error || !user) return NextResponse.json({ company_id: null })

    const supabase = db()
    const { data: userRow } = await supabase
      .from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!userRow) return NextResponse.json({ company_id: null })

    const { data: company } = await supabase
      .from('companies').select('id').eq('user_id', userRow.id).maybeSingle()

    return NextResponse.json({ company_id: company?.id ?? null })
  } catch {
    return NextResponse.json({ company_id: null })
  }
}
