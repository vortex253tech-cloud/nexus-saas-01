// lib/analytics.ts — NEXUS lightweight server-side event tracking
//
// All events are stored in analytics_events table.
// No third-party dependency — clean, LGPD-friendly.
// Client-side: POST /api/analytics/track
// Server-side: trackEvent() directly

import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Event catalogue ──────────────────────────────────────────────────────────

export type EventName =
  // Activation funnel
  | 'signup'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_data_added'
  | 'first_ai_analysis'
  | 'activation_complete'      // user has seen value (analysis run + data exists)

  // Feature usage
  | 'autopilot_toggled'
  | 'action_executed'
  | 'action_approved_manual'
  | 'insight_generated'
  | 'report_exported'
  | 'whatsapp_sent'
  | 'email_sent'
  | 'decision_engine_ran'
  | 'financial_data_added'
  | 'client_added'
  | 'lead_added'

  // Revenue / billing
  | 'upgrade_page_viewed'
  | 'checkout_started'
  | 'checkout_completed'
  | 'subscription_activated'
  | 'subscription_canceled'
  | 'trial_started'
  | 'trial_converted'
  | 'trial_expired'
  | 'revenue_recovered'        // actual money recovered via action

  // Engagement
  | 'dashboard_viewed'
  | 'paywall_hit'
  | 'session_started'

export interface AnalyticsEvent {
  name:       EventName
  company_id: string
  user_id?:   string
  plan?:      string
  value?:     number            // monetary value in BRL (for revenue events)
  properties?: Record<string, unknown>
}

// ─── Server-side tracker ─────────────────────────────────────────────────────

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const db = getSupabaseServerClient()
    await db.from('analytics_events').insert({
      name:       event.name,
      company_id: event.company_id,
      user_id:    event.user_id ?? null,
      plan:       event.plan ?? null,
      value:      event.value ?? null,
      properties: event.properties ?? null,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Non-blocking — analytics must never crash the app
  }
}

// ─── Aggregate helpers (for analytics dashboard) ──────────────────────────────

export async function getActivationRate(since: Date): Promise<{
  signups:      number
  activated:    number
  rate_pct:     number
}> {
  const db     = getSupabaseServerClient()
  const sinceISO = since.toISOString()

  const [signupsRes, activatedRes] = await Promise.all([
    db.from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('name', 'signup')
      .gte('created_at', sinceISO),
    db.from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('name', 'activation_complete')
      .gte('created_at', sinceISO),
  ])

  const signups   = signupsRes.count  ?? 0
  const activated = activatedRes.count ?? 0
  return { signups, activated, rate_pct: signups > 0 ? (activated / signups) * 100 : 0 }
}

export async function getFeatureUsage(companyId: string, since: Date): Promise<Record<string, number>> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('analytics_events')
    .select('name')
    .eq('company_id', companyId)
    .gte('created_at', since.toISOString())

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const n = row.name as string
    counts[n] = (counts[n] ?? 0) + 1
  }
  return counts
}

export async function getTotalRevenue(companyId: string, since: Date): Promise<number> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('analytics_events')
    .select('value')
    .eq('company_id', companyId)
    .eq('name', 'revenue_recovered')
    .gte('created_at', since.toISOString())

  return (data ?? []).reduce((s, r) => s + ((r.value as number) ?? 0), 0)
}
