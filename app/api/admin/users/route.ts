// GET  /api/admin/users         — list all users with subscription + usage
// POST /api/admin/users         — manually update a user's plan

import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@supabase/supabase-js'
import { getAuthContext }             from '@/lib/auth'
import type { Plan }                  from '@/lib/db'

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function verifyAdmin(): Promise<NextResponse | null> {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!SUPER_ADMIN_EMAILS.includes(ctx.email)) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }
  return null
}

// ── GET — list all users ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await verifyAdmin()
  if (denied) return denied

  const db      = adminDb()
  const page    = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit   = 50
  const offset  = (page - 1) * limit
  const search  = req.nextUrl.searchParams.get('q') ?? ''

  let query = db
    .from('users')
    .select(`
      id,
      auth_id,
      email,
      name,
      plan,
      created_at,
      companies(id, name),
      subscriptions(status, plan, stripe_customer_id, trial_ends_at, current_period_end, created_at)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch AI usage stats (message counts from nexus_ai_messages)
  const userIds = (data ?? []).map(u => u.id).filter(Boolean)
  let aiUsage: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: msgs } = await db
      .from('nexus_ai_messages')
      .select('company_id')
      .in('company_id', (data ?? []).map(u => (u.companies as { id?: string }[] | null)?.[0]?.id).filter(Boolean) as string[])
    if (msgs) {
      for (const m of msgs) {
        aiUsage[m.company_id] = (aiUsage[m.company_id] ?? 0) + 1
      }
    }
  }

  const enriched = (data ?? []).map(u => {
    const sub = Array.isArray(u.subscriptions) ? u.subscriptions[0] : null
    const co  = Array.isArray(u.companies)     ? u.companies[0]     : null
    return {
      id:               u.id,
      email:            u.email,
      name:             u.name,
      plan:             u.plan,
      company_id:       co?.id,
      company_name:     co?.name,
      subscription:     sub,
      ai_messages_used: aiUsage[co?.id ?? ''] ?? 0,
      created_at:       u.created_at,
    }
  })

  return NextResponse.json({
    users: enriched,
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

// ── POST — update user plan ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await verifyAdmin()
  if (denied) return denied

  const body = await req.json() as { user_id: string; plan: Plan; note?: string }
  const { user_id, plan, note } = body

  if (!user_id || !plan) {
    return NextResponse.json({ error: 'user_id and plan required' }, { status: 400 })
  }

  const validPlans: Plan[] = ['free', 'starter', 'pro', 'scale', 'enterprise']
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` }, { status: 400 })
  }

  const db = adminDb()

  // Update users.plan
  const { error: userErr } = await db
    .from('users')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', user_id)

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  // Update subscriptions.plan if exists
  await db
    .from('subscriptions')
    .update({ plan, status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', user_id)

  console.log(`[admin] Plan updated: user=${user_id} plan=${plan} note="${note ?? ''}"`)

  return NextResponse.json({ ok: true, user_id, plan })
}
