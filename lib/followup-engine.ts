// ──────────────────────────────────────────────────────────────────────────────
// NEXUS FOLLOW-UP ENGINE
// Multi-stage automated follow-up: 1h → 24h → 3d
// ──────────────────────────────────────────────────────────────────────────────

import { getSupabaseServerClient } from '@/lib/supabase'
import { classifyTier } from '@/lib/lead-capture'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowupLead {
  id:              string
  company_id:      string
  name:            string
  phone:           string | null
  email:           string | null
  source:          string
  status:          string
  score:           number
  followup_stage:  number
  last_followup_at: string | null
  created_at:      string
  first_message:   string | null
}

// ─── Message Templates ────────────────────────────────────────────────────────

export function buildFollowupMessage(lead: FollowupLead, stage: 1 | 2 | 3): string {
  const firstName = lead.name.split(' ')[0]
  const tier      = classifyTier(lead.score)

  const messages: Record<typeof stage, string[]> = {
    1: [
      // 1h — soft touch
      tier === 'HOT'
        ? `${firstName}, vi que você entrou em contato! Ainda posso te ajudar agora? Temos uma condição especial disponível só hoje. 🔥`
        : `Oi ${firstName}! Vi que você entrou em contato. Como posso ajudar? Pode me contar mais sobre o que você precisa?`,
      `${firstName}, oi! Queria ter certeza que recebi seu contato. Quando tiver um minuto, me conta o que está buscando! 😊`,
    ],
    2: [
      // 24h — value proposition
      tier === 'HOT'
        ? `${firstName}, nossa oferta especial ainda está disponível para você! Clientes com perfil similar ao seu têm resultado em média em 30 dias. Posso enviar a proposta personalizada agora?`
        : `Oi ${firstName}! Passando para ver se surgiu alguma dúvida. Preparei algumas informações que podem te ajudar a decidir. Quer receber?`,
      `${firstName}, tudo bem? Só para garantir que você não perdeu nada — nossa solução pode te ajudar com resultados reais. Posso te mostrar um case similar ao seu negócio?`,
    ],
    3: [
      // 3d — final push
      tier === 'HOT'
        ? `${firstName}, última chance! Nossa condição especial encerra hoje. Isso é o suficiente para você começar e ver resultados nos primeiros 30 dias. Quer ativar agora? É simples e rápido. ⚡`
        : `${firstName}, nosso time analisou o seu perfil e identificamos uma oportunidade especial para você. Posso reservar uma conversa de 15 minutos para apresentar?`,
      `Oi ${firstName}! Não quero incomodar, mas vi que você ainda não aproveitou nossa proposta. Se mudou de ideia ou a vida ficou corrida, sem problemas — mas se ainda tiver interesse, estou aqui. 🙏`,
    ],
  }

  const pool = messages[stage]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Stage Timing ──────────────────────────────────────────────────────────────

function hoursSince(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

function shouldSendStage(lead: FollowupLead): 1 | 2 | 3 | null {
  if (lead.status === 'won' || lead.status === 'lost') return null

  const hoursSinceCreated   = hoursSince(lead.created_at)
  const hoursSinceLastFU    = hoursSince(lead.last_followup_at)

  if (lead.followup_stage === 0 && hoursSinceCreated >= 1)    return 1
  if (lead.followup_stage === 1 && hoursSinceLastFU  >= 24)   return 2
  if (lead.followup_stage === 2 && hoursSinceLastFU  >= 72)   return 3

  return null
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

export interface FollowupResult {
  processed: number
  skipped:   number
  failed:    number
}

export async function runFollowupEngine(): Promise<FollowupResult> {
  const db  = getSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch leads eligible for followup (stages 0, 1, 2 only)
  const { data: leads, error } = await db
    .from('leads')
    .select('id, company_id, name, phone, email, source, status, score, followup_stage, last_followup_at, created_at, first_message')
    .in('followup_stage', [0, 1, 2])
    .not('status', 'in', '("won","lost")')
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[followup-engine] DB error:', error.message)
    return { processed: 0, skipped: 0, failed: 0 }
  }

  let processed = 0, skipped = 0, failed = 0

  for (const lead of (leads ?? []) as FollowupLead[]) {
    const stage = shouldSendStage(lead)
    if (!stage) { skipped++; continue }

    try {
      const message = buildFollowupMessage(lead, stage)

      // Find or create conversation
      let convId: string | null = null
      const { data: existingConv } = await db
        .from('sales_conversations')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('company_id', lead.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingConv?.id) {
        convId = existingConv.id
      } else {
        const { data: newConv } = await db
          .from('sales_conversations')
          .insert({ lead_id: lead.id, company_id: lead.company_id })
          .select('id')
          .single()
        convId = newConv?.id ?? null
      }

      // Persist message + update lead + log event in parallel
      await Promise.all([
        convId
          ? db.from('sales_messages').insert({
              conversation_id: convId,
              role:            'ai',
              content:         message,
            })
          : Promise.resolve(),

        db.from('leads')
          .update({
            followup_stage:   stage,
            last_followup_at: now,
          })
          .eq('id', lead.id),

        db.from('sales_actions').insert({
          lead_id:     lead.id,
          company_id:  lead.company_id,
          type:        'followup',
          status:      'sent',
          payload:     { message, stage, source: 'followup_engine' },
          executed_at: now,
        }),

        db.from('analytics_events').insert({
          company_id: lead.company_id,
          lead_id:    lead.id,
          event_type: 'followup_sent',
          channel:    lead.source,
          metadata:   { stage, tier: classifyTier(lead.score) },
        }),
      ])

      processed++
    } catch (err) {
      console.error(`[followup-engine] Error on lead ${lead.id}:`, err)
      failed++
    }
  }

  return { processed, skipped, failed }
}
