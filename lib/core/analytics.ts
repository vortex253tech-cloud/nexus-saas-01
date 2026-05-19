// NEXUS Core Engine — Analytics
// Centralizes all metrics across modules. Single call = full dashboard picture.

import { createClient } from '@supabase/supabase-js'
import type { DashboardMetrics } from './types'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Dashboard summary (all modules) ─────────────────────────────────────────

export async function getDashboardMetrics(company_id: string): Promise<DashboardMetrics> {
  const supabase = db()
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [
    convTotal, convActive, convAI,
    msgTotal, msgAI, msgToday,
    revenueData,
    autoStats,
    conversionData,
  ] = await Promise.all([
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('status', 'active'),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('ai_enabled', true),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('company_id', company_id),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('ai_generated', true).eq('direction', 'outgoing'),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('company_id', company_id).gte('created_at', today.toISOString()),
    supabase.from('payments').select('amount').eq('status', 'paid').gte('created_at', monthStart.toISOString()),
    supabase.from('automations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('is_active', true),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('status', 'converted'),
  ])

  // Revenue calculation
  const payments     = (revenueData.data ?? []) as Array<{ amount: number }>
  const revenueMonth = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const revenueFormatted = revenueMonth >= 1000
    ? `R$${(revenueMonth / 1000).toFixed(1)}k`
    : `R$${revenueMonth.toFixed(0)}`

  // Derived rates
  const totalMsg    = msgTotal.count ?? 0
  const aiMsg       = msgAI.count    ?? 0
  const responseRate = totalMsg > 0 ? `${Math.round((aiMsg / totalMsg) * 100)}%` : '—'

  const totalConv     = convTotal.count      ?? 0
  const convertedConv = conversionData.count ?? 0
  const conversionRate = totalConv > 0 ? `${Math.round((convertedConv / totalConv) * 100)}%` : '—'

  // Lead totals: use whatsapp_conversations as proxy
  const hotLeads = Math.round((convActive.count ?? 0) * 0.2)

  return {
    conversations: {
      total:      totalConv,
      active:     convActive.count   ?? 0,
      ai_enabled: convAI.count       ?? 0,
    },
    messages: {
      total:        totalMsg,
      ai_generated: aiMsg,
      today:        msgToday.count   ?? 0,
    },
    leads: {
      total:     totalConv,
      hot:       hotLeads,
      converted: convertedConv,
    },
    revenue: {
      month:     revenueMonth,
      formatted: revenueFormatted,
    },
    automations: {
      active:           autoStats.count ?? 0,
      executions_today: 0,
    },
    ai_performance: {
      response_rate:   responseRate,
      conversion_rate: conversionRate,
    },
  }
}

// ─── WhatsApp-specific stats ──────────────────────────────────────────────────

export async function getWhatsAppStats(company_id: string) {
  const supabase = db()

  const [total, active, aiEnabled, unread] = await Promise.all([
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('status', 'active'),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).eq('ai_enabled', true),
    supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', company_id).gt('unread_count', 0),
  ])

  return {
    total_conversations: total.count    ?? 0,
    active_conversations: active.count  ?? 0,
    ai_enabled:           aiEnabled.count ?? 0,
    unread_conversations: unread.count   ?? 0,
  }
}

// ─── Revenue stats ────────────────────────────────────────────────────────────

export async function getRevenueStats(company_id: string) {
  const supabase = db()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const lastMonthStart = new Date(monthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)

  const [thisMonth, lastMonth] = await Promise.all([
    supabase.from('payments').select('amount').eq('status', 'paid').gte('created_at', monthStart.toISOString()),
    supabase.from('payments').select('amount').eq('status', 'paid').gte('created_at', lastMonthStart.toISOString()).lt('created_at', monthStart.toISOString()),
  ])

  const calcTotal = (rows: Array<{ amount: number }>) =>
    rows.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  const thisTotal = calcTotal((thisMonth.data ?? []) as Array<{ amount: number }>)
  const lastTotal = calcTotal((lastMonth.data ?? []) as Array<{ amount: number }>)
  const growth    = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0

  return {
    month_total:   thisTotal,
    last_month:    lastTotal,
    growth_pct:    growth,
    formatted:     thisTotal >= 1000 ? `R$${(thisTotal / 1000).toFixed(1)}k` : `R$${thisTotal.toFixed(0)}`,
  }
}
