// ─── NEXUS AI Intent Router ───────────────────────────────────────────────────
// Maps natural-language Portuguese user intent → contextual dashboard routes.
// Rule-based first (zero cost, instant). Claude fallback for ambiguous queries.

import Anthropic from '@anthropic-ai/sdk'

export interface IntentRoute {
  route:       string
  label:       string
  confidence:  number   // 0–1
  reasoning:   string
  actionHint?: string   // suggested first action at destination
}

// ─── Rule table ───────────────────────────────────────────────────────────────
// Each entry: { patterns (case-insensitive substrings), route, label, hint }

const RULES: Array<{
  patterns:   string[]
  route:      string
  label:      string
  actionHint: string
}> = [
  {
    patterns:   ['inadimpl', 'deve', 'devendo', 'atraso', 'cobrar', 'cobrança', 'cobranc', 'deve money', 'quien me deve', 'quem me deve'],
    route:      '/dashboard/financeiro?filter=inadimplentes',
    label:      'Financeiro — Inadimplentes',
    actionHint: 'Disparar cobrança automática via WhatsApp/e-mail',
  },
  {
    patterns:   ['venda', 'vender', 'funil', 'pipeline', 'fechar', 'closar', 'prospect', 'receita', 'faturamento'],
    route:      '/dashboard/sales',
    label:      'Vendas IA',
    actionHint: 'Analisar funil de vendas e leads parados',
  },
  {
    patterns:   ['custo', 'fornecedor', 'despesa', 'reduzir custo', 'cortar gasto', 'economizar', 'supplier'],
    route:      '/dashboard/suppliers',
    label:      'Custos — Fornecedores',
    actionHint: 'Ver fornecedores com alertas de custo alto',
  },
  {
    patterns:   ['lead', 'frio', 'quente', 'prospects', 'captação', 'captaçao', 'prospectar', 'oportunidade'],
    route:      '/dashboard/leads',
    label:      'Leads & CRM',
    actionHint: 'Filtrar leads quentes prontos para contato',
  },
  {
    patterns:   ['relatório', 'relatorio', 'análise', 'analise', 'analytics', 'crescimento', 'receita mensal'],
    route:      '/dashboard/revenue',
    label:      'Relatórios de Receita',
    actionHint: 'Gerar relatório completo dos últimos 30 dias',
  },
  {
    patterns:   ['whatsapp', 'mensagem', 'campanha', 'email', 'e-mail', 'disparar', 'enviar mensagem'],
    route:      '/dashboard/messages',
    label:      'Mensagens & Campanhas',
    actionHint: 'Criar campanha WhatsApp para clientes inativos',
  },
  {
    patterns:   ['automação', 'automacao', 'fluxo', 'flow', 'robo', 'robô', 'automatizar'],
    route:      '/dashboard/actions',
    label:      'Fluxos de Automação',
    actionHint: 'Ver e gerenciar fluxos ativos',
  },
  {
    patterns:   ['cliente', 'crm', 'cadastro', 'retenção', 'retençao', 'churn', 'perder cliente'],
    route:      '/dashboard/clients',
    label:      'Clientes & CRM',
    actionHint: 'Ver clientes em risco de churn',
  },
  {
    patterns:   ['financeiro', 'caixa', 'fluxo caixa', 'balancete', 'dre', 'lucro', 'margem'],
    route:      '/dashboard/financeiro',
    label:      'Painel Financeiro',
    actionHint: 'Analisar saúde financeira completa',
  },
  {
    patterns:   ['oportunidade', 'crescer', 'crescimento', 'potencial', 'expand'],
    route:      '/dashboard/growth-map',
    label:      'Mapa de Crescimento',
    actionHint: 'Ver mapa de oportunidades identificadas pela IA',
  },
  {
    patterns:   ['consultor', 'conselho', 'estratégia', 'estrategia', 'orientação', 'orientacao'],
    route:      '/dashboard/advisor',
    label:      'Consultor IA',
    actionHint: 'Iniciar sessão estratégica com o consultor',
  },
]

// ─── Rule-based matching ──────────────────────────────────────────────────────

function matchRules(query: string): IntentRoute | null {
  const q = query.toLowerCase()
  for (const rule of RULES) {
    if (rule.patterns.some(p => q.includes(p))) {
      return {
        route:      rule.route,
        label:      rule.label,
        confidence: 0.92,
        reasoning:  `Palavra-chave detectada em: "${rule.patterns.find(p => q.includes(p))}"`,
        actionHint: rule.actionHint,
      }
    }
  }
  return null
}

// ─── Claude fallback ──────────────────────────────────────────────────────────

async function aiMatch(query: string): Promise<IntentRoute> {
  const client = new Anthropic()

  const routeList = RULES.map(r => `${r.route} → ${r.label}`).join('\n')

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `You are a dashboard router for a Brazilian SaaS. Given the user query, pick the best route.

ROUTES:
${routeList}

USER QUERY: "${query}"

Reply with JSON only: {"route":"/dashboard/...","label":"...","reasoning":"one sentence"}`,
    }],
  })

  try {
    const text = (msg.content[0] as { type: string; text: string }).text
    const parsed = JSON.parse(text) as { route: string; label: string; reasoning: string }
    return {
      route:      parsed.route ?? '/dashboard',
      label:      parsed.label ?? 'Dashboard',
      confidence: 0.75,
      reasoning:  parsed.reasoning ?? 'IA determinou rota',
    }
  } catch {
    return { route: '/dashboard', label: 'Dashboard', confidence: 0.4, reasoning: 'Fallback padrão' }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function resolveIntent(query: string): Promise<IntentRoute> {
  if (!query.trim()) {
    return { route: '/dashboard', label: 'Dashboard', confidence: 1, reasoning: 'Query vazia' }
  }

  const rule = matchRules(query)
  if (rule) return rule

  if (process.env.ANTHROPIC_API_KEY) {
    try { return await aiMatch(query) } catch { /* fall through */ }
  }

  return { route: '/dashboard', label: 'Dashboard', confidence: 0.3, reasoning: 'Sem correspondência encontrada' }
}
