// ─── lead_context → leads sync ─────────────────────────────────────────────
// Server-side only. Mirrors a WhatsApp lead's extracted context into the
// general `leads` table so it shows up in /dashboard/leads alongside leads
// from every other channel — the WhatsApp CRM and the Leads module used to
// be two disconnected systems (see docs/decisoes.md, item 7).

// Both vocabularies seen across the two WhatsApp pipelines' extraction
// prompts get mapped onto the same `leads.stage` enum.
const STAGE_MAP: Record<string, string> = {
  novo:          'novo',
  descoberta:    'novo',
  qualificado:   'qualificado',
  interessado:   'qualificado',
  consideracao:  'qualificado',
  'consideração': 'qualificado',
  negociando:    'negociando',
  decisao:       'negociando',
  'decisão':     'negociando',
  proposta:      'proposta',
  cliente:       'fechado',
  fechado:       'fechado',
  perdido:       'perdido',
}

// leads.status uses a separate (English) vocabulary — kept in sync so the
// /dashboard/leads list, which filters by status, also picks these up.
const STATUS_MAP: Record<string, string> = {
  novo:        'new',
  qualificado: 'qualified',
  negociando:  'contacted',
  proposta:    'proposal',
  fechado:     'converted',
  perdido:     'lost',
}

export interface WhatsAppLeadContext {
  nome?:        string | null
  empresa?:     string | null
  nicho?:       string | null
  estagio?:     string | null
  score?:       number | null
}

/**
 * Upserts a lead derived from a WhatsApp conversation into the `leads`
 * table, keyed by (company_id, phone). Safe to call repeatedly — only
 * raises the score, never lowers it, and only advances the stage forward
 * (a lead that already reached "negociando" won't regress to "novo" just
 * because a later message reads as less qualified than an earlier one).
 */
export async function syncWhatsAppLeadToLeads(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:  any
  companyId: string
  phone:     string
  context:   WhatsAppLeadContext
}): Promise<void> {
  const { supabase, companyId, phone, context } = params

  const { data: existing } = await supabase
    .from('leads')
    .select('id, name, score, stage')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  const stageKey = (context.estagio ?? '').toLowerCase().trim()
  const stage    = STAGE_MAP[stageKey] ?? existing?.stage ?? 'novo'
  const status   = STATUS_MAP[stage]   ?? 'new'
  const score    = context.score ?? 0
  const name     = context.nome || existing?.name || `WhatsApp ${phone.slice(-4)}`
  const now      = new Date().toISOString()

  if (existing?.id) {
    await supabase.from('leads').update({
      name,
      empresa:          context.empresa ?? null,
      nicho:            context.nicho   ?? null,
      score:            Math.max(score, existing.score ?? 0),
      stage,
      status,
      canal:            'whatsapp',
      ultima_interacao: now,
    }).eq('id', existing.id)
  } else {
    await supabase.from('leads').insert({
      company_id:       companyId,
      name,
      phone,
      empresa:          context.empresa ?? null,
      nicho:            context.nicho   ?? null,
      score,
      stage,
      status,
      canal:            'whatsapp',
      origem:           'whatsapp',
      ultima_interacao: now,
    })
  }
}
