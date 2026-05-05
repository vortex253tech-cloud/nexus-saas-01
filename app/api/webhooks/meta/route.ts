// GET  /api/webhooks/meta — Meta webhook verification (Instagram DM + Ads)
// POST /api/webhooks/meta — Receive Instagram DMs and Meta Ads events
//
// Supported webhooks:
//   - Instagram DM (messaging)
//   - Lead form submissions (leadgen)
//   - Ad campaign events

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { captureLead } from '@/lib/lead-capture'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaMessagingEntry {
  sender:    { id: string }
  recipient: { id: string }
  timestamp: number
  message?:  { mid: string; text: string }
}

interface MetaLeadGenEntry {
  id:          string
  field_data:  Array<{ name: string; values: string[] }>
  created_time: number
  ad_id:       string
  adset_id:    string
  campaign_id: string
  form_id:     string
}

// ─── GET — Webhook Verification ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const expected  = process.env.META_VERIFY_TOKEN

  if (mode === 'subscribe' && token === expected && challenge) {
    console.log('[webhooks/meta] ✅ verification OK')
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  console.warn('[webhooks/meta] ❌ verification failed', { mode, tokenMatch: token === expected })
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — Event Handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Always return 200 immediately — Meta retries on non-200
  try {
    const body = await req.json()
    console.log('[webhooks/meta] event:', JSON.stringify(body).slice(0, 200))
    void processMetaEvent(body)
  } catch (err) {
    console.error('[webhooks/meta] parse error:', err)
  }
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

// ─── Event Processing ─────────────────────────────────────────────────────────

async function processMetaEvent(body: Record<string, unknown>): Promise<void> {
  const object = body.object as string
  const entries = (body.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    try {
      if (object === 'instagram') {
        await handleInstagramDm(entry)
      } else if (object === 'page') {
        await handleLeadGenForm(entry)
      } else if (object === 'ad_account') {
        await handleAdEvent(entry)
      }
    } catch (err) {
      console.error('[webhooks/meta] error processing entry:', err)
    }
  }
}

// ─── Instagram DM handler ─────────────────────────────────────────────────────

async function handleInstagramDm(entry: Record<string, unknown>): Promise<void> {
  const messagingList = (entry.messaging as MetaMessagingEntry[]) ?? []

  for (const event of messagingList) {
    if (!event.message?.text) continue

    const igUserId = event.sender.id
    const text     = event.message.text.trim()

    console.log('[webhooks/meta] Instagram DM from', igUserId, ':', text)

    // Resolve company from recipient page (page_id → company_id lookup)
    const recipientId = event.recipient.id
    const companyId   = await resolveCompanyFromPage(recipientId)
    if (!companyId) {
      console.warn('[webhooks/meta] No company found for page', recipientId)
      continue
    }

    // Capture as lead
    await captureLead({
      name:      `Instagram ${igUserId}`,
      phone:     null,
      email:     null,
      source:    'instagram',
      message:   text,
      companyId,
    })
  }
}

// ─── Lead Gen Form handler ────────────────────────────────────────────────────

async function handleLeadGenForm(entry: Record<string, unknown>): Promise<void> {
  const changes = (entry.changes as Array<{ field: string; value: MetaLeadGenEntry }>) ?? []

  for (const change of changes) {
    if (change.field !== 'leadgen') continue

    const lead = change.value
    const fields = Object.fromEntries(
      lead.field_data.map(f => [f.name, f.values[0] ?? ''])
    )

    const companyId = await resolveCompanyFromForm(lead.form_id)
    if (!companyId) continue

    const name  = fields['full_name'] ?? fields['name'] ?? fields['nome'] ?? 'Lead Meta'
    const email = fields['email'] ?? null
    const phone = fields['phone_number'] ?? fields['telefone'] ?? null

    await captureLead({
      name,
      phone,
      email,
      source:     'instagram',
      message:    fields['message'] ?? fields['mensagem'] ?? null,
      companyId,
      campaignId: lead.campaign_id,
      adSetId:    lead.adset_id,
      adId:       lead.ad_id,
    })
  }
}

// ─── Ad Event handler (campaign spend tracking) ───────────────────────────────

async function handleAdEvent(entry: Record<string, unknown>): Promise<void> {
  // Log ad events for campaign optimization
  const changes = (entry.changes as Array<{ field: string; value: Record<string, unknown> }>) ?? []

  for (const change of changes) {
    console.log('[webhooks/meta] ad event:', change.field, JSON.stringify(change.value).slice(0, 100))
    // Future: update campaigns table with spend/impression data
    void change
  }
}

// ─── Company Resolution ───────────────────────────────────────────────────────

async function resolveCompanyFromPage(pageId: string): Promise<string | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('companies')
    .select('id')
    .eq('meta_page_id', pageId)
    .maybeSingle()
  return data?.id ?? null
}

async function resolveCompanyFromForm(formId: string): Promise<string | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('companies')
    .select('id')
    .contains('metadata', { meta_form_id: formId })
    .maybeSingle()
  return data?.id ?? null
}
