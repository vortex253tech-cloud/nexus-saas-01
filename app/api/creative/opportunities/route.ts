// GET /api/creative/opportunities
// Fetches real business analysis and maps it into creative-action opportunity cards
// with specific monetary values, urgency levels, and module redirect links.

import { NextResponse }              from 'next/server'
import Anthropic                     from '@anthropic-ai/sdk'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { fetchBusinessData, buildAnalysisContext } from '@/lib/services/business-advisor'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'

export const dynamic     = 'force-dynamic'
export const maxDuration = 45

export interface OpportunityCard {
  id:          string
  type:        'cobranca' | 'reativacao' | 'lancamento' | 'risco' | 'crescimento'
  emoji:       string
  headline:    string
  value:       string      // e.g. "R$12.400"
  description: string
  urgency:     'critical' | 'high' | 'medium'
  actions: Array<{
    label:  string
    href?:  string
    action?: string   // 'generate_campaign' | 'open_tab'
    tab?:   string
    obj?:   string
  }>
}

interface OpportunityResponse {
  cards:         OpportunityCard[]
  summary:       string
  health_score:  number
  company_name:  string
}

// ─── Resolve company ─────────────────────────────────────────────────────────

// Resolve strictly from the authenticated session — never fall back to "first
// company in the table". denyIfCannot() above already requires a session, so
// this should never actually miss; a silent DB-wide fallback here would risk
// surfacing another tenant's financial/business data in the analysis.
async function resolveCompanyId(): Promise<string | null> {
  const ctx = await getAuthContext()
  return ctx?.companyId ?? null
}

async function resolveCompanyName(companyId: string): Promise<string> {
  try {
    const db = getSupabaseServerClient()
    const { data } = await db
      .from('companies')
      .select('fantasy_name, name')
      .eq('id', companyId)
      .single()
    return (data as { fantasy_name?: string; name?: string } | null)?.fantasy_name
      || (data as { fantasy_name?: string; name?: string } | null)?.name
      || 'Minha Empresa'
  } catch { return 'Minha Empresa' }
}

// ─── Build prompt ─────────────────────────────────────────────────────────────

function buildOpportunityPrompt(): string {
  return `Você é o NEXUS — uma IA executiva que monitora negócios em tempo real.
Analise os dados da empresa e retorne exatamente entre 4 e 6 oportunidades de ação de alto impacto.

RETORNE APENAS JSON VÁLIDO — sem markdown, sem texto extra.

Schema:
{
  "health_score": <0-100>,
  "summary": "<frase executiva de 1 linha sobre a situação do negócio>",
  "cards": [
    {
      "id": "op-1",
      "type": "<cobranca|reativacao|lancamento|risco|crescimento>",
      "emoji": "<emoji único que representa o insight>",
      "headline": "<título de impacto em até 8 palavras>",
      "value": "<valor monetário específico, ex: R$8.200 ou 23 clientes>",
      "description": "<1-2 frases precisas com dados reais>",
      "urgency": "<critical|high|medium>",
      "actions": [
        { "label": "<texto do botão>", "href": "<rota opcional>" },
        { "label": "<texto do botão>", "action": "generate_campaign", "tab": "<whatsapp|email|campanhas>", "obj": "<cobranca|reativacao|lancamento|promocao|boas_vindas|follow_up>" }
      ]
    }
  ]
}

ROTAS DISPONÍVEIS PARA "href":
- /dashboard/financial → cobrança, receita, pagamentos
- /dashboard/clientes → clientes, reativação, CRM
- /dashboard/campanhas → campanhas, disparos
- /dashboard/analytics → métricas, relatórios
- /dashboard/automations → automações, fluxos

REGRAS:
- Sempre inclua pelo menos 1 card de tipo "cobranca" se houver inadimplência
- Sempre inclua pelo menos 1 card de tipo "reativacao" se houver clientes inativos
- Urgência "critical" = ação imediata (dinheiro perdido agora)
- Urgência "high" = prazo de 3 dias
- Urgência "medium" = prazo de 1 semana
- Use valores REAIS dos dados quando disponíveis — nunca invente
- Cada card deve ter 2-3 actions (pelo menos 1 navigate + 1 generate)`
}

// ─── Stub cards for when AI is unavailable ───────────────────────────────────

function buildStubCards(companyName: string): OpportunityResponse {
  return {
    health_score: 72,
    summary: `${companyName} tem oportunidades imediatas de recuperação de receita e reativação de clientes.`,
    company_name: companyName,
    cards: [
      {
        id: 'op-1',
        type: 'cobranca',
        emoji: '💰',
        headline: 'Recupere receita inadimplente hoje',
        value: 'R$4.800',
        description: 'Clientes com pagamentos em atraso há mais de 7 dias. Campanha de cobrança ativa pode recuperar até 68%.',
        urgency: 'critical',
        actions: [
          { label: 'Gerar campanha de cobrança', action: 'generate_campaign', tab: 'whatsapp', obj: 'cobranca' },
          { label: 'Ver inadimplentes', href: '/dashboard/financial' },
        ],
      },
      {
        id: 'op-2',
        type: 'reativacao',
        emoji: '🔥',
        headline: '18 clientes prontos para comprar',
        value: '18 clientes',
        description: 'Clientes que compraram entre 30-60 dias atrás e não retornaram. Momento ideal para reativação com oferta exclusiva.',
        urgency: 'high',
        actions: [
          { label: 'Criar campanha de reativação', action: 'generate_campaign', tab: 'whatsapp', obj: 'reativacao' },
          { label: 'Ver segmento', href: '/dashboard/clientes' },
        ],
      },
      {
        id: 'op-3',
        type: 'crescimento',
        emoji: '📈',
        headline: 'Taxa de conversão abaixo do potencial',
        value: '+34% possível',
        description: 'Análise dos fluxos mostra que follow-ups automáticos podem triplicar conversões no funil atual.',
        urgency: 'medium',
        actions: [
          { label: 'Criar follow-up', action: 'generate_campaign', tab: 'email', obj: 'follow_up' },
          { label: 'Ver analytics', href: '/dashboard/analytics' },
        ],
      },
      {
        id: 'op-4',
        type: 'risco',
        emoji: '⚠️',
        headline: 'Clientes VIP sem interação recente',
        value: '3 clientes',
        description: 'Seus 3 maiores clientes não interagem há mais de 15 dias. Risco de churn alto — contato proativo urgente.',
        urgency: 'critical',
        actions: [
          { label: 'Gerar mensagem VIP', action: 'generate_campaign', tab: 'whatsapp', obj: 'follow_up' },
          { label: 'Abrir CRM', href: '/dashboard/clientes' },
        ],
      },
    ],
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  try {
    const companyId = await resolveCompanyId()
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyName = await resolveCompanyName(companyId)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ...buildStubCards(companyName) })
    }

    const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
    if (overLimit) return overLimit

    // Fetch real business data
    const data = await fetchBusinessData(companyId)
    const context = buildAnalysisContext(data)

    const client = new Anthropic({ apiKey })

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system:     buildOpportunityPrompt(),
      messages: [{
        role:    'user',
        content: `Empresa: ${companyName}\n\nDados reais:\n${context}\n\nGere as oportunidades de ação conforme instruções.`,
      }],
    })

    const raw = res.content[0]?.type === 'text' ? res.content[0].text.trim() : null
    if (!raw) return NextResponse.json(buildStubCards(companyName))

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned) as {
      health_score: number
      summary: string
      cards: OpportunityCard[]
    }

    void incrementAiUsage(companyId)
    return NextResponse.json({
      ...parsed,
      company_name: companyName,
    } satisfies OpportunityResponse)

  } catch (err) {
    console.error('[creative/opportunities]', err)
    const companyId = await resolveCompanyId().catch(() => null)
    const companyName = companyId ? await resolveCompanyName(companyId) : 'Minha Empresa'
    return NextResponse.json(buildStubCards(companyName))
  }
}
