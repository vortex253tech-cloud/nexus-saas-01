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

// ─── Get authenticated user + company from session cookie ─────
// Returns null if not authenticated or company not found.
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await getSupabaseRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return null

    console.log('[auth] AUTH USER ID:', authUser.id, '| email:', authUser.email)

    const db = getSupabaseServerClient()

    // Find custom user by auth_id or email
    const { data: user, error: userErr } = await db
      .from('users')
      .select('*')
      .or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
      .returns<DBUser[]>()
      .maybeSingle()

    if (userErr) console.error('[auth] users query error:', userErr)
    if (!user) {
      console.warn('[auth] no user record found for auth_id:', authUser.id)
      return null
    }

    // If auth_id not set yet, update it
    if (!('auth_id' in user) || (user as Record<string, unknown>).auth_id !== authUser.id) {
      await db.from('users').update({ auth_id: authUser.id }).eq('id', user.id)
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
