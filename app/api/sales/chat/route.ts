// POST /api/sales/chat — AI Sales Conversation Engine
// Flow: receive message → classify → respond → log action

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import {
  generateSalesResponse,
  scoreLeadFromSource,
  classifyLead,
  type Lead,
  type SalesMessage,
  type BusinessContext,
} from '@/lib/sales-engine'

export const dynamic = 'force-dynamic'

// ─── Load business context from DB ───────────────────────────────────────────

async function loadBusinessContext(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
): Promise<BusinessContext> {
  const [companyRes, clientsRes, finRes] = await Promise.all([
    db.from('companies').select('name, brand_name').eq('id', companyId).maybeSingle(),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    db.from('financial_data').select('revenue').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const company       = companyRes.data
  const total_clients = clientsRes.count ?? 0
  const revenue       = finRes.data?.revenue ?? 0

  // Estimate average ticket from revenue / clients
  const average_ticket = total_clients > 0 ? Math.round(revenue / total_clients) : 497

  return {
    company_name:    company?.brand_name ?? company?.name ?? 'NEXUS',
    average_ticket:  average_ticket > 0 ? average_ticket : 497,
    monthly_revenue: revenue,
    total_clients,
    main_product:    undefined,
  }
}

// ─── Ensure conversation exists ───────────────────────────────────────────────

async function ensureConversation(
  db: ReturnType<typeof getSupabaseServerClient>,
  leadId: string,
  companyId: string,
): Promise<string> {
  // Find existing open conversation
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

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body    = await readJsonObject(req)
    const leadId  = body ? getString(body, 'lead_id')  : null
    const message = body ? getString(body, 'message')  : null
    const bodyCompany = body ? getString(body, 'company_id') : null

    if (!leadId || !message?.trim()) {
      return NextResponse.json({ error: 'lead_id and message are required' }, { status: 400 })
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    let companyId: string | null = bodyCompany ?? null
    try {
      const auth = await getAuthContext()
      if (auth?.companyId) companyId = auth.companyId
    } catch { /* ok */ }

    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getSupabaseServerClient()

    // ── Load lead ─────────────────────────────────────────────────────────────
    const { data: leadRow, error: leadErr } = await db
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = leadRow as Lead

    // ── Ensure conversation ───────────────────────────────────────────────────
    const conversationId = await ensureConversation(db, lead.id, companyId)

    // ── Load conversation history ─────────────────────────────────────────────
    const { data: historyRows } = await db
      .from('sales_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    const history: SalesMessage[] = (historyRows ?? []).map(r => ({
      role:    r.role as SalesMessage['role'],
      content: r.content,
    }))

    // ── Load business context ─────────────────────────────────────────────────
    const ctx = await loadBusinessContext(db, companyId)

    // ── Generate AI response ──────────────────────────────────────────────────
    const result = await generateSalesResponse(lead, history, message.trim(), ctx)

    // ── Persist messages ──────────────────────────────────────────────────────
    await db.from('sales_messages').insert([
      { conversation_id: conversationId, role: 'lead', content: message.trim() },
      { conversation_id: conversationId, role: 'ai',   content: result.message   },
    ])

    // ── Update lead score + status ────────────────────────────────────────────
    await db
      .from('leads')
      .update({ score: result.new_score, status: result.new_status })
      .eq('id', lead.id)

    // ── Log action ────────────────────────────────────────────────────────────
    if (result.next_action) {
      const scheduled = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await db.from('sales_actions').insert({
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
    console.error('[sales/chat] ERROR:', msg)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

// ─── GET: initialize lead conversation (optional) ────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')

  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  let companyId: string | null = null
  try {
    const auth = await getAuthContext()
    if (auth?.companyId) companyId = auth.companyId
  } catch { /* ok */ }

  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  const { data: lead } = await db
    .from('leads')
    .select('id, name, score, status, source')
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { data: conv } = await db
    .from('sales_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const conversationId = conv?.id ?? null

  const messages = conversationId ? await db
    .from('sales_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }) : { data: [] }

  return NextResponse.json({
    lead,
    tier:            classifyLead(lead.score as number),
    conversation_id: conversationId,
    messages:        messages.data ?? [],
  })
}
