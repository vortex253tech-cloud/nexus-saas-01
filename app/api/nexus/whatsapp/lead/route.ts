// GET /api/nexus/whatsapp/lead?conversation_id=xxx
// Returns real AI-extracted lead intelligence from lead_context + leads tables

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { createClient }            from '@supabase/supabase-js'

export const dynamic     = 'force-dynamic'
export const maxDuration = 10

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) return NextResponse.json({ lead: null }, { status: 400 })

  // ── Auth ──────────────────────────────────────────────────────
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ lead: null }, { status: 401 })

  const supabase = db()

  // ── Resolve company ───────────────────────────────────────────
  const { data: userRow } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userRow) return NextResponse.json({ lead: null })

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
  if (!company) return NextResponse.json({ lead: null })

  // ── Verify conversation ownership ─────────────────────────────
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, phone, contact_name')
    .eq('id', conversationId)
    .eq('company_id', company.id)
    .maybeSingle()
  if (!conv) return NextResponse.json({ lead: null })

  // ── Parallel queries ──────────────────────────────────────────
  const [contextRes, leadRes, msgCountRes] = await Promise.all([
    // AI-extracted intelligence per conversation
    supabase
      .from('lead_context')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle(),

    // CRM lead record (synced by webhook)
    supabase
      .from('leads')
      .select('id, name, stage, temperatura, score, updated_at')
      .eq('company_id', company.id)
      .eq('phone', conv.phone)
      .maybeSingle(),

    // Message count for this conversation
    supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId),
  ])

  const ctx  = contextRes.data
  const lead = leadRes.data
  const msgCount = msgCountRes.count ?? 0

  // ── Compute derived metrics ───────────────────────────────────
  const score       = lead?.score ?? ctx?.score ?? 0
  const temperatura = lead?.temperatura ?? (score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio')
  const stage       = lead?.stage ?? ctx?.estagio ?? 'novo'

  // Conversion probability based on score + stage
  const stageBonus: Record<string, number> = {
    negociando: 15, proposta: 10, interessado: 5, qualificado: 3,
  }
  const conversionPct = Math.min(95, score + (stageBonus[stage] ?? 0))

  // Estimated revenue based on faturamento field
  const faturStr = ctx?.faturamento ?? ''
  let estimatedRevenue: string | null = null
  if (faturStr.includes('50k') || faturStr.includes('50.000')) estimatedRevenue = 'R$ 4.800/mês'
  else if (faturStr.includes('100k') || faturStr.includes('100.000')) estimatedRevenue = 'R$ 9.700/mês'
  else if (faturStr.includes('200k') || faturStr.includes('200.000')) estimatedRevenue = 'R$ 19.400/mês'
  else if (score >= 70) estimatedRevenue = 'R$ 5.800/mês'
  else if (score >= 40) estimatedRevenue = 'R$ 2.900/mês'

  return NextResponse.json({
    lead: {
      // Identity
      name:        lead?.name        ?? ctx?.nome         ?? conv.contact_name ?? null,
      phone:       conv.phone,
      empresa:     ctx?.empresa      ?? null,
      nicho:       ctx?.nicho        ?? null,
      faturamento: ctx?.faturamento  ?? null,

      // CRM
      stage,
      temperatura,
      score,
      estagio:     ctx?.estagio      ?? 'novo',

      // Intelligence
      dores:          (ctx?.dores as string[] | null)    ?? [],
      objetivo:       ctx?.objetivo       ?? null,
      usa_crm:        ctx?.usa_crm        ?? null,
      usa_automacao:  ctx?.usa_automacao  ?? null,
      perde_whatsapp: ctx?.perde_whatsapp ?? null,

      // Computed
      conversion_pct:    conversionPct,
      estimated_revenue: estimatedRevenue,
      message_count:     msgCount,

      // Freshness
      has_real_data: !!(ctx || lead),
    },
  })
}
