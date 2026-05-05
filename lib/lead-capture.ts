// ──────────────────────────────────────────────────────────────────────────────
// NEXUS LEAD CAPTURE ENGINE
// Unified normalization, dedup, scoring, and event logging
// ──────────────────────────────────────────────────────────────────────────────

import { getSupabaseServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaptureSource = 'whatsapp' | 'instagram' | 'site' | 'manual' | 'other'

export interface CaptureInput {
  name:         string
  phone?:       string | null
  email?:       string | null
  source:       CaptureSource
  message?:     string | null
  companyId:    string
  // UTM / Ads tracking
  utmSource?:   string | null
  utmMedium?:   string | null
  utmCampaign?: string | null
  utmContent?:  string | null
  campaignId?:  string | null
  adSetId?:     string | null
  adId?:        string | null
  ipAddress?:   string | null
  referrer?:    string | null
}

export interface CaptureResult {
  lead:  Record<string, unknown>
  isNew: boolean
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_SOURCES = new Set<CaptureSource>(['whatsapp', 'instagram', 'site', 'manual', 'other'])

export function normalizeCaptureInput(raw: Partial<CaptureInput>): CaptureInput | null {
  const name = raw.name?.trim()
  if (!name) return null

  const source: CaptureSource = VALID_SOURCES.has(raw.source as CaptureSource)
    ? (raw.source as CaptureSource)
    : 'other'

  const companyId = raw.companyId?.trim()
  if (!companyId) return null

  return {
    name,
    phone:       raw.phone?.trim()       || null,
    email:       raw.email?.trim()?.toLowerCase() || null,
    source,
    message:     raw.message?.trim()     || null,
    companyId,
    utmSource:   raw.utmSource?.trim()   || null,
    utmMedium:   raw.utmMedium?.trim()   || null,
    utmCampaign: raw.utmCampaign?.trim() || null,
    utmContent:  raw.utmContent?.trim()  || null,
    campaignId:  raw.campaignId?.trim()  || null,
    adSetId:     raw.adSetId?.trim()     || null,
    adId:        raw.adId?.trim()        || null,
    ipAddress:   raw.ipAddress?.trim()   || null,
    referrer:    raw.referrer?.trim()    || null,
  }
}

// ─── Intent Scoring ───────────────────────────────────────────────────────────

const HIGH_INTENT = [
  'quero', 'comprar', 'contratar', 'quanto custa', 'preço', 'valor',
  'assinar', 'pagar', 'agora', 'hoje', 'urgente', 'preciso',
  'quero contratar', 'quanto é', 'qual o valor',
]
const MED_INTENT  = [
  'interesse', 'mais informações', 'como funciona', 'detalhes', 'planos',
  'saber mais', 'gostaria', 'queria',
]
const LOW_INTENT  = [
  'só curiosidade', 'talvez', 'futuro', 'só queria saber',
]

export function scoreMessageIntent(message: string | null | undefined): number {
  if (!message) return 0
  const m = message.toLowerCase()
  let score = 0
  HIGH_INTENT.forEach(kw => { if (m.includes(kw)) score += 15 })
  MED_INTENT.forEach(kw  => { if (m.includes(kw)) score += 8  })
  LOW_INTENT.forEach(kw  => { if (m.includes(kw)) score -= 5  })
  return Math.min(Math.max(score, 0), 40)
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

const SOURCE_SCORES: Record<CaptureSource, number> = {
  whatsapp:  25,  // high intent — initiated contact
  instagram: 20,
  site:      30,  // highest — filled a form
  manual:    15,
  other:     10,
}

export function computeInitialScore(input: CaptureInput): number {
  let score = SOURCE_SCORES[input.source] ?? 10

  // Contact completeness
  if (input.email?.trim()) score += 10
  if (input.phone?.trim()) score += 10

  // Message intent
  score += scoreMessageIntent(input.message)

  return Math.min(Math.max(score, 0), 100)
}

export function classifyTier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 80) return 'HOT'
  if (score >= 50) return 'WARM'
  return 'COLD'
}

// ─── Deduplication ───────────────────────────────────────────────────────────

export async function findExistingLead(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  phone?: string | null,
  email?: string | null,
): Promise<Record<string, unknown> | null> {
  if (!phone && !email) return null

  const orParts: string[] = []
  if (phone?.trim()) orParts.push(`phone.eq.${phone.trim()}`)
  if (email?.trim()) orParts.push(`email.eq.${email.trim().toLowerCase()}`)

  const { data } = await db
    .from('leads')
    .select('*')
    .eq('company_id', companyId)
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

// ─── Core Capture Function ────────────────────────────────────────────────────

export async function captureLead(input: CaptureInput): Promise<CaptureResult> {
  const db = getSupabaseServerClient()

  // Dedup check
  const existing = await findExistingLead(db, input.companyId, input.phone, input.email)
  if (existing) {
    // Update score if new message has higher intent
    const newIntentScore = scoreMessageIntent(input.message)
    if (newIntentScore > 0) {
      const currentScore = (existing.score as number) ?? 0
      const boosted = Math.min(currentScore + newIntentScore, 100)
      if (boosted > currentScore) {
        await db
          .from('leads')
          .update({ score: boosted, intent_score: newIntentScore })
          .eq('id', existing.id as string)
        existing.score = boosted
      }
    }
    return { lead: existing, isNew: false }
  }

  // Compute initial score
  const intentScore    = scoreMessageIntent(input.message)
  const score          = computeInitialScore(input)

  // Insert lead
  const { data, error } = await db
    .from('leads')
    .insert({
      company_id:    input.companyId,
      name:          input.name,
      phone:         input.phone ?? null,
      email:         input.email ?? null,
      source:        input.source,
      notes:         null,
      score,
      status:        'new',
      first_message: input.message ?? null,
      intent_score:  intentScore,
      utm_source:    input.utmSource ?? null,
      utm_medium:    input.utmMedium ?? null,
      utm_campaign:  input.utmCampaign ?? null,
      utm_content:   input.utmContent ?? null,
      campaign_id:   input.campaignId ?? null,
      ad_set_id:     input.adSetId ?? null,
      ad_id:         input.adId ?? null,
      ip_address:    input.ipAddress ?? null,
      referrer:      input.referrer ?? null,
      followup_stage: 0,
    })
    .select()
    .single()

  if (error) throw new Error(`Lead insert failed: ${error.message}`)

  // Log analytics event (non-blocking)
  void db.from('analytics_events').insert({
    company_id: input.companyId,
    lead_id:    data.id,
    event_type: 'lead_captured',
    channel:    input.source,
    metadata:   {
      utm_source:  input.utmSource,
      utm_campaign: input.utmCampaign,
      score,
      tier:        classifyTier(score),
    },
  })

  return { lead: data, isNew: true }
}

// ─── Log Conversion ───────────────────────────────────────────────────────────

export async function logConversion(
  companyId: string,
  leadId:    string,
  amount:    number,
  channel:   string,
): Promise<void> {
  const db = getSupabaseServerClient()

  await Promise.all([
    db.from('analytics_events').insert({
      company_id: companyId,
      lead_id:    leadId,
      event_type: 'payment_completed',
      channel,
      value:      amount,
    }),
    db.from('leads')
      .update({ status: 'won', converted_at: new Date().toISOString(), revenue: amount })
      .eq('id', leadId)
      .eq('company_id', companyId),
  ])
}
