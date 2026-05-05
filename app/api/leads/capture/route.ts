// POST /api/leads/capture — unified multi-channel lead ingestion
//
// Accepts leads from: WhatsApp, Instagram, landing pages, manual entry
// Normalizes, deduplicates, scores, and triggers auto-reply

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getString, readJsonObject } from '@/lib/unknown'
import {
  normalizeCaptureInput,
  captureLead,
  classifyTier,
  type CaptureSource,
} from '@/lib/lead-capture'
import {
  generateSalesResponse,
  classifyLead,
  type Lead,
  type BusinessContext,
} from '@/lib/sales-engine'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─── Load business context for AI personalization ─────────────────────────────

async function getBusinessCtx(
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
  const average_ticket = total_clients > 0 ? Math.round(revenue / total_clients) : 497

  return {
    company_name:    company?.brand_name ?? company?.name ?? 'NEXUS',
    average_ticket:  average_ticket > 0 ? average_ticket : 497,
    monthly_revenue: revenue,
    total_clients,
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    if (!body) {
      return NextResponse.json({ error: 'Body required' }, { status: 400 })
    }

    // ── Resolve company_id ────────────────────────────────────────────────────
    let companyId: string | null = getString(body, 'tenant_id') ?? getString(body, 'company_id') ?? null
    if (!companyId) {
      try {
        const auth = await getAuthContext()
        if (auth?.companyId) companyId = auth.companyId
      } catch { /* ok — public endpoint for webhooks */ }
    }
    if (!companyId) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    }

    // ── Normalize input ───────────────────────────────────────────────────────
    const rawInput = {
      name:         getString(body, 'name') ?? '',
      phone:        getString(body, 'phone'),
      email:        getString(body, 'email'),
      source:       (getString(body, 'source') as CaptureSource) ?? 'other',
      message:      getString(body, 'message'),
      companyId,
      utmSource:    getString(body, 'utm_source'),
      utmMedium:    getString(body, 'utm_medium'),
      utmCampaign:  getString(body, 'utm_campaign'),
      utmContent:   getString(body, 'utm_content'),
      campaignId:   getString(body, 'campaign_id'),
      adSetId:      getString(body, 'ad_set_id'),
      adId:         getString(body, 'ad_id'),
      ipAddress:    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      referrer:     req.headers.get('referer') ?? null,
    }

    const normalized = normalizeCaptureInput(rawInput)
    if (!normalized) {
      return NextResponse.json({ error: 'name and tenant_id are required' }, { status: 400 })
    }

    // ── Capture lead (dedup + insert) ─────────────────────────────────────────
    const { lead, isNew } = await captureLead(normalized)
    const tier = classifyTier(lead.score as number)

    // ── Auto-reply: generate first AI message ─────────────────────────────────
    let autoReply: string | null = null
    try {
      const db  = getSupabaseServerClient()
      const ctx = await getBusinessCtx(db, companyId)

      const salesLead: Lead = {
        id:         lead.id as string,
        company_id: companyId,
        name:       lead.name as string,
        phone:      (lead.phone as string) ?? null,
        email:      (lead.email as string) ?? null,
        source:     lead.source as Lead['source'],
        status:     lead.status as Lead['status'],
        score:      lead.score as number,
        notes:      null,
        metadata:   {},
        created_at: lead.created_at as string,
        updated_at: lead.updated_at as string,
      }

      // Generate AI greeting with the lead's first message as context
      const greeting = normalized.message?.trim()
        ?? `Olá, meu nome é ${normalized.name}`

      const result = await generateSalesResponse(salesLead, [], greeting, ctx)
      autoReply = result.message

      // Persist conversation + messages
      const { data: conv } = await db
        .from('sales_conversations')
        .insert({ lead_id: lead.id, company_id: companyId })
        .select('id')
        .single()

      if (conv?.id) {
        const messagesToInsert = [
          { conversation_id: conv.id, role: 'lead', content: greeting },
          { conversation_id: conv.id, role: 'ai',   content: autoReply },
        ]
        await db.from('sales_messages').insert(messagesToInsert)

        // Update lead score from AI engine
        await db.from('leads')
          .update({ score: result.new_score, status: result.new_status })
          .eq('id', lead.id as string)
      }

      // Log auto-reply event
      void db.from('analytics_events').insert({
        company_id: companyId,
        lead_id:    lead.id,
        event_type: 'auto_reply_sent',
        channel:    normalized.source,
        metadata:   { tier, score: lead.score, isNew },
      })
    } catch (aiErr) {
      // AI failure never blocks lead capture
      console.error('[leads/capture] auto-reply error:', aiErr)
    }

    return NextResponse.json(
      {
        lead:       { ...lead, tier },
        isNew,
        auto_reply: autoReply,
      },
      { status: isNew ? 201 : 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[leads/capture] ERROR:', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
