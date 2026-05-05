// GET /api/sales/analytics — Growth & Sales Analytics
//
// Returns aggregated data for the /dashboard/growth page:
// leads/day, conversion by channel, pipeline funnel,
// revenue attribution, and campaign performance

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { classifyTier } from '@/lib/lead-capture'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)

  const db        = getSupabaseServerClient()
  const companyId = auth.companyId
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [leadsRes, actionsRes, campaignsRes, eventsRes] = await Promise.all([
      db
        .from('leads')
        .select('id, source, status, score, created_at, revenue, converted_at')
        .eq('company_id', companyId)
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: true }),

      db
        .from('sales_actions')
        .select('type, status, payload, executed_at, created_at')
        .eq('company_id', companyId)
        .eq('type', 'payment')
        .eq('status', 'sent')
        .gte('created_at', sinceDate),

      db
        .from('campaigns')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('leads_count', { ascending: false })
        .limit(10),

      db
        .from('analytics_events')
        .select('event_type, channel, value, created_at')
        .eq('company_id', companyId)
        .gte('created_at', sinceDate),
    ])

    const leads     = leadsRes.data    ?? []
    const actions   = actionsRes.data  ?? []
    const campaigns = campaignsRes.data ?? []
    const events    = eventsRes.data   ?? []

    // ── Pipeline funnel ───────────────────────────────────────────────────────
    const pipeline = {
      new:       leads.filter(l => l.status === 'new').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      proposal:  leads.filter(l => l.status === 'proposal').length,
      won:       leads.filter(l => l.status === 'won').length,
      lost:      leads.filter(l => l.status === 'lost').length,
      nurture:   leads.filter(l => l.status === 'nurture').length,
    }

    // ── Tier distribution ─────────────────────────────────────────────────────
    const tiers = {
      HOT:  leads.filter(l => classifyTier(l.score) === 'HOT').length,
      WARM: leads.filter(l => classifyTier(l.score) === 'WARM').length,
      COLD: leads.filter(l => classifyTier(l.score) === 'COLD').length,
    }

    // ── Revenue from sales_actions (payment.amount in payload) ────────────────
    let totalRevenue = 0
    for (const a of actions) {
      const amount = (a.payload as Record<string, unknown>)?.amount
      if (typeof amount === 'number' && amount > 0) totalRevenue += amount
    }
    // Also sum from leads.revenue column (won leads)
    for (const l of leads) {
      if (l.status === 'won' && l.revenue && l.revenue > 0) totalRevenue += Number(l.revenue)
    }
    // Deduplicate (rough): just use max
    const wonLeadsRevenue = leads.filter(l => l.status === 'won' && l.revenue > 0)
      .reduce((sum, l) => sum + Number(l.revenue), 0)
    const finalRevenue = Math.max(totalRevenue, wonLeadsRevenue)

    // ── Summary ───────────────────────────────────────────────────────────────
    const total       = leads.length
    const won         = pipeline.won
    const convRate    = total > 0 ? Math.round((won / total) * 100 * 10) / 10 : 0
    const wonLeads    = leads.filter(l => l.status === 'won')
    const avgTicket   = wonLeads.length > 0
      ? Math.round(wonLeads.reduce((s, l) => s + Number(l.revenue || 0), 0) / wonLeads.length)
      : 0

    const summary = {
      total_leads:     total,
      conversions:     won,
      conversion_rate: convRate,
      revenue:         finalRevenue,
      avg_ticket:      avgTicket,
      hot_leads:       tiers.HOT,
      warm_leads:      tiers.WARM,
      cold_leads:      tiers.COLD,
    }

    // ── Leads per day ─────────────────────────────────────────────────────────
    const byDayMap = new Map<string, { leads: number; conversions: number; revenue: number }>()
    for (const l of leads) {
      const date = l.created_at.slice(0, 10)
      const entry = byDayMap.get(date) ?? { leads: 0, conversions: 0, revenue: 0 }
      entry.leads++
      if (l.status === 'won') {
        entry.conversions++
        entry.revenue += Number(l.revenue || 0)
      }
      byDayMap.set(date, entry)
    }
    const by_day = Array.from(byDayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── By channel ────────────────────────────────────────────────────────────
    const channelMap = new Map<string, { leads: number; conversions: number; revenue: number; hot: number }>()
    for (const l of leads) {
      const ch    = l.source ?? 'other'
      const entry = channelMap.get(ch) ?? { leads: 0, conversions: 0, revenue: 0, hot: 0 }
      entry.leads++
      if (l.status === 'won') { entry.conversions++; entry.revenue += Number(l.revenue || 0) }
      if (classifyTier(l.score) === 'HOT') entry.hot++
      channelMap.set(ch, entry)
    }
    const by_channel = Array.from(channelMap.entries())
      .map(([channel, v]) => ({
        channel,
        ...v,
        conversion_rate: v.leads > 0 ? Math.round((v.conversions / v.leads) * 100) : 0,
      }))
      .sort((a, b) => b.leads - a.leads)

    // ── Auto-optimization flags ───────────────────────────────────────────────
    const best_channel = by_channel.sort((a, b) => b.conversion_rate - a.conversion_rate)[0]?.channel ?? null
    const worst_channel = [...by_channel].sort((a, b) => a.conversion_rate - b.conversion_rate)[0]?.channel ?? null

    const optimization = {
      best_channel,
      worst_channel,
      avg_conversion_rate: convRate,
      recommendation: best_channel
        ? `Canal "${best_channel}" tem a melhor taxa de conversão. Aumente o investimento.`
        : 'Capture mais leads para análise de canal.',
      flags: [] as string[],
    }
    // Flag bad channels (0% conversion with 5+ leads)
    for (const ch of by_channel) {
      if (ch.leads >= 5 && ch.conversion_rate === 0) {
        optimization.flags.push(`⚠️ Canal "${ch.channel}" com ${ch.leads} leads e 0% conversão`)
      }
    }
    if (tiers.COLD > tiers.HOT + tiers.WARM) {
      optimization.flags.push('⚠️ Maioria dos leads são COLD — revisar qualificação de entrada')
    }

    // ── Event funnel (for visualization) ─────────────────────────────────────
    const eventCounts: Record<string, number> = {}
    for (const e of events) {
      eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1
    }
    const funnel = {
      captured:         eventCounts['lead_captured']       ?? total,
      auto_replied:     eventCounts['auto_reply_sent']     ?? 0,
      messages_sent:    eventCounts['message_sent']        ?? 0,
      offers_generated: eventCounts['offer_generated']     ?? 0,
      payments_started: eventCounts['payment_initiated']   ?? 0,
      payments_done:    eventCounts['payment_completed']   ?? won,
      followups_sent:   eventCounts['followup_sent']       ?? 0,
    }

    return NextResponse.json({
      summary,
      pipeline,
      tiers,
      by_day,
      by_channel,
      funnel,
      campaigns,
      optimization,
      period_days: days,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sales/analytics] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
