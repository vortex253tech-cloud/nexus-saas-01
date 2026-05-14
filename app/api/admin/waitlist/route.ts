// GET /api/admin/waitlist — Lista todos os inscritos da waitlist
// Protegido por ADMIN_SECRET header

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(req: Request) {
  const auth = req.headers.get('x-admin-secret')
  if (!ADMIN_SECRET || auth !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.toLowerCase() ?? ''
  const sort = searchParams.get('sort') ?? 'position'
  const order = searchParams.get('order') === 'desc' ? false : true

  let query = supabase
    .from('waitlist')
    .select('id, name, email, company, team_size, position, referral_code, referred_by, referrals_count, source, created_at')
    .order(sort, { ascending: order })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`) as typeof query
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count: total } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true })

  const { count: withReferrals } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true })
    .gt('referrals_count', 0)

  const { data: topReferrer } = await supabase
    .from('waitlist')
    .select('name, referrals_count')
    .order('referrals_count', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    data,
    stats: {
      total: total ?? 0,
      withReferrals: withReferrals ?? 0,
      topReferrer: topReferrer ?? null,
    },
  })
}
