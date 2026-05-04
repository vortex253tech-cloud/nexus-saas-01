// ──────────────────────────────────────────────────────────────────────────────
// NEXUS SALES AUTOMATION ENGINE — Core Logic
// Lead scoring, classification, AI conversation, offer generation
// ──────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadSource   = 'whatsapp' | 'instagram' | 'site' | 'manual' | 'other'
export type LeadStatus   = 'new' | 'qualified' | 'proposal' | 'won' | 'lost' | 'nurture'
export type LeadTier     = 'HOT' | 'WARM' | 'COLD'
export type MessageRole  = 'lead' | 'ai' | 'human'
export type ActionType   = 'offer' | 'followup' | 'payment' | 'recovery' | 'automation' | 'message'

export interface Lead {
  id:         string
  company_id: string
  name:       string
  phone:      string | null
  email:      string | null
  source:     LeadSource
  status:     LeadStatus
  score:      number
  notes:      string | null
  metadata:   Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SalesMessage {
  role:    MessageRole
  content: string
}

export interface BusinessContext {
  company_name:     string
  average_ticket:   number
  monthly_revenue:  number
  total_clients:    number
  main_product?:    string
}

export interface Offer {
  title:     string
  value:     string
  value_raw: number
  reason:    string
  cta:       string
  urgency?:  string
}

export interface SalesResponse {
  message:    string
  tier:       LeadTier
  new_score:  number
  new_status: LeadStatus
  offer?:     Offer
  next_action?: ActionType
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

const SOURCE_SCORES: Record<LeadSource, number> = {
  whatsapp:  20,  // high intent
  instagram: 15,
  site:      25,  // highest intent
  manual:    10,
  other:     5,
}

export function scoreLeadFromSource(source: LeadSource): number {
  return SOURCE_SCORES[source] ?? 5
}

export function recalculateScore(
  lead: Lead,
  messageCount: number,
  hasEmail: boolean,
  hasPhone: boolean,
): number {
  let score = lead.score

  // Engagement: more messages = higher intent
  score += Math.min(messageCount * 5, 30)

  // Contact completeness
  if (hasEmail) score += 10
  if (hasPhone) score += 10

  // Status progression
  const statusBonus: Record<LeadStatus, number> = {
    new:       0,
    qualified: 20,
    proposal:  35,
    won:       50,
    lost:      0,
    nurture:   5,
  }
  score += statusBonus[lead.status] ?? 0

  return Math.min(Math.max(score, 0), 100)
}

export function classifyLead(score: number): LeadTier {
  if (score >= 70) return 'HOT'
  if (score >= 40) return 'WARM'
  return 'COLD'
}

export function tierToNextStatus(tier: LeadTier, current: LeadStatus): LeadStatus {
  if (current === 'won' || current === 'lost') return current
  if (tier === 'HOT')  return 'proposal'
  if (tier === 'WARM') return 'qualified'
  return 'nurture'
}

// ─── Offer Generation ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  site:      'site',
  manual:    'indicação',
  other:     'contato',
}

export function generateOffer(lead: Lead, ctx: BusinessContext): Offer {
  const base = ctx.average_ticket > 0 ? ctx.average_ticket : 497
  const tier = classifyLead(lead.score)

  // HOT leads get urgency discount
  const discount = tier === 'HOT' ? 0.90 : 1.0  // 10% off for HOT
  const value_raw = Math.round(base * discount)

  const fmt = (n: number) =>
    `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`

  const urgency = tier === 'HOT'
    ? '⚡ Oferta por tempo limitado — válida por 24h'
    : undefined

  const reason = tier === 'HOT'
    ? `Com base no seu interesse pelo ${ctx.main_product ?? 'nosso serviço'} via ${SOURCE_LABELS[lead.source]}, personalizamos essa oferta exclusiva para você.`
    : `Identificamos que o ${ctx.main_product ?? 'nosso serviço'} é ideal para o seu perfil, com resultados médios de ${fmt(ctx.monthly_revenue > 0 ? Math.round(ctx.monthly_revenue * 0.15) : 1500)}/mês para clientes similares.`

  return {
    title:     ctx.main_product ? `${ctx.main_product} — Plano Recomendado` : 'Plano Personalizado para Você',
    value:     fmt(value_raw),
    value_raw,
    reason,
    cta:       'Ativar agora →',
    urgency,
  }
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  lead: Lead,
  tier: LeadTier,
  ctx: BusinessContext,
  offer?: Offer,
): string {
  const tierInstructions: Record<LeadTier, string> = {
    HOT: `O lead está QUENTE (score ${lead.score}/100). Ele demonstrou alto interesse.
ESTRATÉGIA: Apresente a oferta diretamente, crie urgência, facilite a decisão.
- Seja direto e confiante
- Mencione o valor e urgência
- Peça decisão agora
- Elimine objeções rapidamente`,

    WARM: `O lead está MORNO (score ${lead.score}/100). Ele tem interesse mas precisa de mais informações.
ESTRATÉGIA: Qualifique melhor, construa valor, mostre resultados.
- Faça 1-2 perguntas qualificadoras
- Apresente provas sociais
- Construa rapport
- Prepare para oferta na próxima mensagem`,

    COLD: `O lead está FRIO (score ${lead.score}/100). Ele ainda não está convencido.
ESTRATÉGIA: Nutra com valor, eduque, construa confiança.
- Compartilhe insights valiosos
- Não tente vender ainda
- Desperte curiosidade
- Identifique a dor principal`,
  }

  const offerBlock = offer
    ? `\n\nOFERTA GERADA PARA ESTE LEAD:\n${JSON.stringify(offer, null, 2)}\nSe o lead estiver HOT, apresente esta oferta naturalmente na conversa.`
    : ''

  return `Você é o NEXUS IA — assistente de vendas inteligente da ${ctx.company_name}.

DADOS DO LEAD:
- Nome: ${lead.name}
- Fonte: ${SOURCE_LABELS[lead.source]}
- Status: ${lead.status}
- Score: ${lead.score}/100
- Tier: ${tier}

CONTEXTO DO NEGÓCIO:
- Empresa: ${ctx.company_name}
- Produto principal: ${ctx.main_product ?? 'Serviço premium'}
- Ticket médio: R$ ${ctx.average_ticket.toLocaleString('pt-BR')}
- Clientes ativos: ${ctx.total_clients}

${tierInstructions[tier]}${offerBlock}

REGRAS CRÍTICAS:
1. Responda SEMPRE em português brasileiro, de forma natural e conversacional
2. Seja empático mas orientado a resultado
3. Máximo 3 frases por resposta — seja conciso
4. NUNCA mencione que é uma IA — aja como consultor humano
5. Use o nome do lead quando possível
6. Termine com uma pergunta ou CTA claro`
}

// ─── AI Sales Conversation ────────────────────────────────────────────────────

export async function generateSalesResponse(
  lead: Lead,
  history: SalesMessage[],
  newMessage: string,
  ctx: BusinessContext,
): Promise<SalesResponse> {
  const messageCount = history.filter(m => m.role === 'lead').length + 1
  const newScore = recalculateScore(
    lead,
    messageCount,
    Boolean(lead.email),
    Boolean(lead.phone),
  )
  const tier       = classifyLead(newScore)
  const new_status = tierToNextStatus(tier, lead.status)

  const offer = tier === 'HOT' && lead.status !== 'won'
    ? generateOffer(lead, ctx)
    : undefined

  const next_action: ActionType = tier === 'HOT'
    ? 'offer'
    : tier === 'WARM'
    ? 'message'
    : 'followup'

  // No API key → rule-based response
  if (!process.env.ANTHROPIC_API_KEY) {
    const message = buildRuleBasedResponse(lead, tier, newMessage, offer)
    return { message, tier, new_score: newScore, new_status, offer, next_action }
  }

  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history
        .slice(-10)  // last 10 messages for context window
        .map(m => ({
          role:    (m.role === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
      { role: 'user', content: newMessage },
    ]

    const res = await ai.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     buildSystemPrompt(lead, tier, ctx, offer),
      messages,
    })

    const message = res.content[0]?.type === 'text'
      ? res.content[0].text.trim()
      : buildRuleBasedResponse(lead, tier, newMessage, offer)

    return { message, tier, new_score: newScore, new_status, offer, next_action }

  } catch (err) {
    console.error('[sales-engine] AI error:', err)
    const message = buildRuleBasedResponse(lead, tier, newMessage, offer)
    return { message, tier, new_score: newScore, new_status, offer, next_action }
  }
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function buildRuleBasedResponse(
  lead: Lead,
  tier: LeadTier,
  _message: string,
  offer?: Offer,
): string {
  const firstName = lead.name.split(' ')[0]

  if (tier === 'HOT' && offer) {
    return `${firstName}, ótimo timing! Tenho uma oferta especial preparada para você: ${offer.title} por apenas ${offer.value}. ${offer.reason} Quer que eu envie os detalhes para você ativar agora?`
  }

  if (tier === 'WARM') {
    return `${firstName}, entendo! Para eu te apresentar a melhor solução, me conta: qual é o seu maior desafio hoje em termos de resultado no negócio?`
  }

  return `${firstName}, obrigado pelo contato! Deixa eu entender melhor o que você precisa — qual é o principal objetivo que quer alcançar?`
}

// ─── Follow-up message generator ─────────────────────────────────────────────

export function generateFollowupMessage(lead: Lead, stage: 'no_response' | 'viewed' | 'proposal'): string {
  const firstName = lead.name.split(' ')[0]

  const messages = {
    no_response: [
      `${firstName}, vi que você entrou em contato mas não conseguimos finalizar a conversa. Posso te ajudar com algo específico?`,
      `Oi ${firstName}! Ainda estou aqui caso precise de mais informações. Qual é a sua maior dúvida?`,
    ],
    viewed: [
      `${firstName}, você viu a proposta mas ainda não finalizou. Tem alguma dúvida ou posso ajustar algo para facilitar?`,
      `Oi ${firstName}! A oferta ainda está disponível. Quer que eu explique mais algum detalhe?`,
    ],
    proposal: [
      `${firstName}, sua proposta está aguardando confirmação. Precisa de mais alguma informação para decidir?`,
      `Oi ${firstName}! Só passando para lembrar que sua oferta personalizada expira em breve. Posso te ajudar com alguma dúvida?`,
    ],
  }

  const pool = messages[stage]
  return pool[Math.floor(Math.random() * pool.length)]
}
