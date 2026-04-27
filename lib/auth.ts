// ─── Auth helpers for API routes ──────────────────────────────
// Server-side only. Import from API routes, never from components.

import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { getSupabaseServerClient } from '@/lib/supabase'
import type { DBCompany, DBSubscription, DBUser, Plan } from '@/lib/db'
import { getTrialDaysLeft, getEffectivePlan } from '@/lib/trial'

export interface AuthContext {
  authId: string
  email: string
  user: DBUser
  company: DBCompany
  companyId: string
  subscription: DBSubscription | null
  effectivePlan: Plan
  trialDaysLeft: number | null
}

// ─── Lightweight: resolve the current auth user only ──────────
// Use this when you only need to verify identity, not load company/plan.
// Returns null if the request has no valid session.
export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = await getSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return { id: user.id, email: user.email ?? '' }
  } catch {
    return null
  }
}

// ─── Get authenticated user + company from session cookie ─────
// Auto-upserts the users row on first login so stale accounts (created
// before the DB trigger was added) always resolve correctly.
// Returns null only when unauthenticated or no company found.
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await getSupabaseRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return null

    console.log('[auth] AUTH USER ID:', authUser.id, '| email:', authUser.email)

    const db = getSupabaseServerClient()

    // Find custom user by auth_id or email
    let { data: user, error: userErr } = await db
      .from('users')
      .select('*')
      .or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
      .returns<DBUser[]>()
      .maybeSingle()

    if (userErr) console.error('[auth] users query error:', userErr)

    // Auto-upsert: create the row on first login if the DB trigger missed it
    if (!user) {
      console.warn('[auth] no user record — upserting for auth_id:', authUser.id)
      const { data: upserted, error: upsertErr } = await db
        .from('users')
        .upsert(
          { auth_id: authUser.id, email: authUser.email ?? '', name: null, plan: 'free' },
          { onConflict: 'email' },
        )
        .select()
        .returns<DBUser[]>()
        .single()

      if (upsertErr) {
        console.error('[auth] users upsert error:', upsertErr)
        return null
      }
      user = upserted
    }

    // Sync auth_id if it wasn't set (legacy rows created before the trigger)
    if (user.auth_id !== authUser.id) {
      await db.from('users').update({ auth_id: authUser.id }).eq('id', user.id)
      user = { ...user, auth_id: authUser.id }
    }

    const { data: company, error: compErr } = await db
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .returns<DBCompany[]>()
      .maybeSingle()

    if (compErr) console.error('[auth] companies query error:', compErr)
    if (!company) {
      console.warn('[auth] no company found for user:', user.id)
      return null
    }

    // Fetch subscription
    const { data: subscription } = await db
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .returns<DBSubscription[]>()
      .maybeSingle()

    const trialDaysLeft = getTrialDaysLeft(subscription ?? null)
    const effectivePlan = getEffectivePlan(subscription ?? null, user.plan)

    console.log('[auth] ✅ resolved — user:', user.id, '| company:', company.id, '| plan:', effectivePlan)

    return {
      authId: authUser.id,
      email: authUser.email ?? user.email,
      user,
      company,
      companyId: company.id,
      subscription: subscription ?? null,
      effectivePlan,
      trialDaysLeft,
    }
  } catch (err) {
    console.error('[auth] getAuthContext error:', err)
    return null
  }
}
