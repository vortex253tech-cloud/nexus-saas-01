// GET /api/creative/stats
// Returns real creative AI usage stats from the database.

import { NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { getAuthContext }            from '@/lib/auth'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const ctx       = await getAuthContext()
  const companyId = ctx?.company.id ?? null
  const supabase  = db()

  // Total generated assets
  let generated = 0
  if (companyId) {
    const { count } = await supabase
      .from('ai_generated_assets')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
    generated = count ?? 0
  } else {
    const { count } = await supabase
      .from('ai_generated_assets')
      .select('id', { count: 'exact', head: true })
    generated = count ?? 0
  }

  // WhatsApp conversations for open/response rate
  let responseRate = '—'
  let aiMessages   = 0
  let totalMessages = 0
  if (companyId) {
    const [aiRes, totalRes] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('ai_generated', true)
        .eq('direction', 'outgoing'),
      supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('direction', 'outgoing'),
    ])
    aiMessages    = aiRes.count    ?? 0
    totalMessages = totalRes.count ?? 0
    if (totalMessages > 0) {
      responseRate = `${Math.round((aiMessages / totalMessages) * 100)}%`
    }
  }

  // Pipeline conversion from whatsapp conversations
  let conversionRate = '—'
  if (companyId) {
    const [totalConvs, qualifiedConvs] = await Promise.all([
      supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),
      supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'converted'),
    ])
    const total     = totalConvs.count    ?? 0
    const qualified = qualifiedConvs.count ?? 0
    if (total > 0) {
      conversionRate = `${Math.round((qualified / total) * 100)}%`
    }
  }

  // Revenue from payments / transactions
  let revenue = 'R$0'
  try {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (payments && payments.length > 0) {
      const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      if (total >= 1000) {
        revenue = `R$${(total / 1000).toFixed(1)}k`
      } else {
        revenue = `R$${total.toFixed(0)}`
      }
    }
  } catch { /* table may not exist */ }

  return NextResponse.json({
    generated,
    response_rate:   responseRate,
    conversion_rate: conversionRate,
    revenue,
  })
}
