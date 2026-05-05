// POST /api/sales/auto-reply — instant AI response engine
//
// Trigger: Lead sends a message (from any channel)
// Goal: Respond in < 2 seconds with personalized sales message
// Auth: accepts company_id in body (for webhook callers)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import {
  generateSalesResponse,
  classifyLead,
  type Lead,
  type SalesMessage,
  type BusinessContext,
} from '@/lib/sales-engine'
import { classifyTier } from '@/lib/lead-capture'

export const dynamic = 'force-dynamic'

// ─── Load context (cached across requests via module-level singleton) ──────────

async function getCtx(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
): Promise<BusinessContext> {
  const [companyRes, clientsRes, finRes] = await Promise.all([
    db.from('companies').select('name, brand_name').eq('id', companyId).maybeSingle(),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    db.from('financial_data').select('revenue').eq('company_id', companyId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const company       = companyRes.data
  const total_clients = clientsRes.count ?? 0
  const revenue       = finRes.data?.revenue ?? 0

  return {
    company_name:    company?.brand_name ?? company?.name ?? 'NEXUS',
    average_ticket:  total_clients > 0 ? Math.round(revenue / total_clients) : 497,
    monthly_revenue: revenue,
    total_clients,
  }
}

async function ensureConversation(
  db: ReturnType<typeof getSupabaseServerClient>,
  leadId: string,
  companyId: string,
): Promise<string> {
  const { data: existing } = await db
    .from('sales_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await db
    .from('sales_conversations')
    .insert({ lead_id: leadId, company_id: companyId })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Cannot create conversation: ${error?.message}`)
  return data.id as string
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

    const leadId  = getString(body, 'lead_id')
    const message = getString(body, 'message')

    if (!leadId || !message?.trim()) {
      return NextResponse.json({ error: 'lead_id and message required' }, { status: 400 })
    }

    // ── Resolve company ───────────────────────────────────────────────────────
    let companyId: string | null = getString(body, 'company_id') ?? null
    if (!companyId) {
      try {
        const auth = await getAuthContext()
        if (auth?.companyId) companyId = auth.companyId
      } catch { /* webhook callers skip auth */ }
    }
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseServerClient()

    // ── Load lead ─────────────────────────────────────────────────────────────
    const { data: leadRow } = await db
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    const lead = leadRow as Lead

    // ── Validate pre-conditions ───────────────────────────────────────────────
    const messageText = message.trim()
    if (!messageText) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    // ── Load context + history in parallel ───────────────────────────────────
    const conversationId = await ensureConversation(db, lead.id, companyId)

    const [ctx, historyRes] = await Promise.all([
      getCtx(db, companyId),
      db
        .from('sales_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10),
    ])

    const history: SalesMessage[] = (historyRes.data ?? []).map(r => ({
      role:    r.role as SalesMessage['role'],
      content: r.content,
    }))

    // ── Generate AI response ──────────────────────────────────────────────────
    const result = await generateSalesResponse(lead, history, messageText, ctx)

    // ── Persist in parallel ───────────────────────────────────────────────────
    await Promise.all([
      db.from('sales_messages').insert([
        { conversation_id: conversationId, role: 'lead', content: messageText },
        { conversation_id: conversationId, role: 'ai',   content: result.message },
      ]),
      db.from('leads')
        .update({ score: result.new_score, status: result.new_status })
        .eq('id', lead.id),
      // Log analytics event
      db.from('analytics_events').insert({
        company_id: companyId,
        lead_id:    lead.id,
        event_type: 'message_sent',
        channel:    lead.source,
        metadata:   {
          tier:       result.tier,
          score:      result.new_score,
          has_offer:  Boolean(result.offer),
        },
      }),
    ])

    // Schedule next action if present (non-blocking)
    if (result.next_action) {
      const scheduled = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h
      void db.from('sales_actions').insert({
        lead_id:       lead.id,
        company_id:    companyId,
        type:          result.next_action,
        status:        'pending',
        payload:       { offer: result.offer ?? null, tier: result.tier },
        scheduled_for: result.next_action === 'followup' ? scheduled : null,
      })
    }

    return NextResponse.json({
      reply:           result.message,
      tier:            result.tier,
      score:           result.new_score,
      status:          result.new_status,
      offer:           result.offer ?? null,
      conversation_id: conversationId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sales/auto-reply] ERROR:', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
