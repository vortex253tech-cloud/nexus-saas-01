// POST /api/company/setup
// Called after the user completes the onboarding welcome flow.
// Updates company name/sector, marks onboarding complete, and sends welcome email.
// Auth: requires valid Supabase session cookie.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { sendOnboardingWelcomeEmail } from '@/lib/email-waitlist'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    empresa?: string
    setor?: string
    team_size?: string
  }

  const { empresa, setor, team_size } = body
  const db = getSupabaseServerClient()

  // Find internal user row linked to this auth session
  const { data: userRow } = await db
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (userRow?.id) {
    const updates: Record<string, unknown> = {}
    if (empresa) updates.name   = empresa
    if (setor)   updates.sector = setor
    // team_size not in schema — ignored

    if (Object.keys(updates).length > 0) {
      await db
        .from('companies')
        .update(updates)
        .eq('user_id', userRow.id)
    }
  }

  // Fire-and-forget welcome email
  sendOnboardingWelcomeEmail({
    name:    userRow?.name ?? user.email ?? 'Founder',
    email:   user.email!,
    empresa: empresa ?? 'sua empresa',
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
