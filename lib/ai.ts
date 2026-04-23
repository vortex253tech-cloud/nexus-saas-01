// ─── AI Integration — Anthropic Claude ────────────────────────
// Server-side only. Never import in client components.

import Anthropic from '@anthropic-ai/sdk'
import type { DBFinancialData } from './db'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─── Types ─────────────────────────────────────────────────────

export interface AIInsight {
  titulo: string
  descricao: string
  detalhe: string
  impacto_estimado: number
  impacto_anual: number
  prazo: string
  prioridade: 'critica' | 'alta' | 'media'
  urgencia: 'alta' | 'media' | 'baixa'
  categoria: 'receita' | 'custo' | 'retencao' | 'operacional' | 'precificacao'
  icone: string
  passos: string[]
  effort_level: 'low' | 'medium' | 'high'
  auto_executable: boolean
  execution_type: 'email' | 'whatsapp' | 'ads' | 'recommendation' | 'analytics'
  message_email?: string   // Ready-to-send email body (HTML-safe plain text)
  message_whatsapp?: string // Ready-to-send WhatsApp message
}

export interface AIAlert {
  tipo: 'perigo' | 'atencao' | 'oportunidade' | 'info'
  titulo: string
  descricao: string
  impacto: string
}

export interface AIAnalysisResult {
  score: number
  resumo: string
  ganho_total_estimado: number
  benchmark_label: string
  insights: AIInsight[]
  alerts: AIAlert[]
  ai_summary: string
}

export interface PreviousInsight {
  titulo: string
  impacto_estimado: number
  categoria: string
  created_at: string
}

export interface PendingAction {
  titulo: string
  status: string
  prioridade: string
  impacto_estimado: number
}

// ─── Context builder ───────────────────────────────────────────

function buildFinancialContext(financialData: DBFinancialData[]): string {
  if (!financialData.length) return 'Nenhum dado financeiro inserido ainda.'

  const sorted = [...financialData].sort(
    (a, b) => new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
  )
  const latest = sorted[sorted.length - 1]
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null

  const margin = latest.revenue > 0 ? ((latest.profit / latest.revenue) * 100).toFixed(1) : '0'
  const costRatio = latest.revenue > 0 ? ((latest.costs / latest.revenue) * 100).toFixed(1) : '0'

  let trend = ''
  if (previous) {
    const profitDiff = latest.profit - previous.profit
    const pct = previous.profit !== 0 ? ((profitDiff / Math.abs(previous.profit)) * 100).toFixed(1) : '0'
    trend = `Comparado ao período anterior (${previous.period_label}): lucro ${profitDiff >= 0 ? '+' : ''}R$${profitDiff.toLocaleString('pt-BR')} (${pct}%)`
  }

  const history = sorted
    .map(d => `- ${d.period_label}: Receita R$${d.revenue.toLocaleString('pt-BR')} | Custo R$${d.costs.toLocaleString('pt-BR')} | Lucro R$${d.profit.toLocaleString('pt-BR')}`)
    .join('\n')

  return `
DADOS FINANCEIROS:
Período mais recente: ${latest.period_label}
Receita: R$${latest.revenue.toLocaleString('pt-BR')}
Custos: R$${latest.costs.toLocaleString('pt-BR')}
Lucro: R$${latest.profit.toLocaleString('pt-BR')}
Margem de lucro: ${margin}%
Proporção custo/receita: ${costRatio}%
${trend}

HISTÓRICO:
${history}
`.trim()
}

// ─── Main analysis function ────────────────────────────────────

export async function generateAIAnalysis(params: {
  perfil: string
  setor: string
  metaMensal: number
  principalDesafio: string
  nomeEmpresa: string
  financialData: DBFinancialData[]
  previousInsights?: PreviousInsight[]
  pendingActions?: PendingAction[]
}): Promise<AIAnalysisResult> {
  const financialContext = buildFinancialContext(params.financialData)
  const hasFinancialData = params.financialData.length > 0

  // ─── Memory context (previous insights + pending actions) ─────
  let memoryContext = ''
  if (params.previousInsights && params.previousInsights.length > 0) {
    memoryContext += '\n\nINSIGHTS ANTERIORES (considere a evolução e NÃO repita os mesmos tópicos):\n'
    memoryContext += params.previousInsights
      .map(i => `- ${i.titulo} | R$${Math.round(i.impacto_estimado).toLocaleString('pt-BR')}/mês | ${i.categoria} | ${new Date(i.created_at).toLocaleDateString('pt-BR')}`)
      .join('\n')
  }
  if (params.pendingActions && params.pendingActions.length > 0) {
    memoryContext += '\n\nAÇÕES PENDENTES JÁ CRIADAS (não duplicar — gere insights complementares):\n'
    memoryContext += params.pendingActions
      .map(a => `- ${a.titulo} [${a.status}] (R$${Math.round(a.impacto_estimado).toLocaleString('pt-BR')}/mês, prioridade: ${a.prioridade})`)
      .join('\n')
  }

  const systemPrompt = `Você é um CFO de guerra — especialista em diagnóstico financeiro de empresas brasileiras com 20 anos de experiência. Sua missão é identificar DINHEIRO PERDIDO que o dono não vê, e mostrar o caminho mais rápido para recuperá-lo.

Regras absolutas:
- Todo insight deve ter valor em R$ real e específico — nunca vago
- Calcule SEMPRE o impacto mensal E anual
- Identifique o que está CUSTANDO dinheiro AGORA (urgência alta)
- Priorize ações com maior ROI E menor esforço (vitórias rápidas primeiro)
- Use linguagem direta, sem jargão — o dono precisa entender em 10 segundos
- Urgência alta = perda ativa de dinheiro neste momento
- Urgência media = oportunidade sendo perdida gradualmente
- Urgência baixa = otimização estratégica de longo prazo`

  const userPrompt = `Analise esta empresa e gere um diagnóstico financeiro completo:

EMPRESA: ${params.nomeEmpresa}
SETOR: ${params.setor}
PERFIL: ${params.perfil}
META MENSAL: R$${params.metaMensal.toLocaleString('pt-BR')}
PRINCIPAL DESAFIO: ${params.principalDesafio}

${financialContext}
${memoryContext}
${!hasFinancialData ? 'Nota: sem dados financeiros reais inseridos ainda — baseie as estimativas no perfil e setor.' : ''}

Retorne EXATAMENTE este JSON (sem markdown, sem texto extra):

{
  "score": <número 0-100 representando saúde financeira>,
  "resumo": "<resumo executivo em 2 frases>",
  "ganho_total_estimado": <valor em R$ do ganho potencial mensal somando todos os insights>,
  "benchmark_label": "<comparação com setor, ex: 'Abaixo da média do setor em 15%'>",
  "ai_summary": "<análise detalhada em 3-4 frases com achados principais>",
  "insights": [
    {
      "titulo": "<título da ação>",
      "descricao": "<problema identificado e por que importa, 1-2 frases>",
      "detalhe": "<como executar detalhadamente>",
      "impacto_estimado": <valor R$/mês>,
      "prazo": "<ex: '3 dias' ou '1 semana'>",
      "prioridade": "<critica|alta|media>",
      "categoria": "<receita|custo|retencao|operacional|precificacao>",
      "icone": "<1 emoji relevante>",
      "passos": ["passo 1", "passo 2", "passo 3", "passo 4", "passo 5"],
      "effort_level": "<low|medium|high — esforço de implementação>",
      "urgencia": "<alta|media|baixa — urgência de implementação>",
      "impacto_anual": <impacto_estimado * 12>,
      "auto_executable": <true se pode ser executado automaticamente pelo sistema (email, whatsapp, ads), false se requer ação humana>,
      "execution_type": "<email|whatsapp|ads|recommendation|analytics>",
      "message_email": "<se execution_type for email: corpo de email pronto para envio, tom profissional, 2-3 parágrafos focados no valor para o cliente, em português. Senão: null>",
      "message_whatsapp": "<se execution_type for whatsapp: mensagem WhatsApp pronta (máximo 300 chars), direta e com CTA claro, em português. Senão: null>"
    }
  ],
  "alerts": [
    {
      "tipo": "<perigo|atencao|oportunidade|info>",
      "titulo": "<título do alerta>",
      "descricao": "<descrição do problema/oportunidade>",
      "impacto": "<impacto em texto, ex: 'R$ 3.200/mês'>"
    }
  ]
}

Gere exatamente 5 insights (ordenados do maior impacto para menor) e exatamente 4 alerts (2 críticos/atenção + 2 oportunidade/info).`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Parse JSON — strip any markdown fences if present
  const jsonStr = text.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim()
  const result = JSON.parse(jsonStr) as AIAnalysisResult
  return result
}

// ─── Quick alert generation from financial data ────────────────

export async function generateAIAlerts(params: {
  financialData: DBFinancialData[]
  perfil: string
}): Promise<AIAlert[]> {
  if (params.financialData.length < 2) return []

  const sorted = [...params.financialData].sort(
    (a, b) => new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
  )
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]

  const profitDrop = prev.profit > 0 && latest.profit < prev.profit * 0.9
  const costIncrease = latest.costs > prev.costs * 1.1
  const marginOk = latest.revenue > 0 && (latest.profit / latest.revenue) > 0.2

  // Generate alerts without AI for speed — rule-based
  const alerts: AIAlert[] = []

  if (profitDrop) {
    const pct = (((prev.profit - latest.profit) / prev.profit) * 100).toFixed(0)
    alerts.push({
      tipo: 'perigo',
      titulo: `Lucro caiu ${pct}% em relação ao mês anterior`,
      descricao: `${prev.period_label}: R$${prev.profit.toLocaleString('pt-BR')} → ${latest.period_label}: R$${latest.profit.toLocaleString('pt-BR')}. Queda significativa que requer atenção imediata.`,
      impacto: `-R$${(prev.profit - latest.profit).toLocaleString('pt-BR')}/mês`,
    })
  }

  if (costIncrease) {
    const pct = (((latest.costs - prev.costs) / prev.costs) * 100).toFixed(0)
    alerts.push({
      tipo: 'atencao',
      titulo: `Custos subiram ${pct}% sem crescimento proporcional`,
      descricao: `Aumento de custos de R$${prev.costs.toLocaleString('pt-BR')} para R$${latest.costs.toLocaleString('pt-BR')} entre ${prev.period_label} e ${latest.period_label}.`,
      impacto: `+R$${(latest.costs - prev.costs).toLocaleString('pt-BR')}/mês`,
    })
  }

  if (!marginOk && latest.revenue > 0) {
    const margin = ((latest.profit / latest.revenue) * 100).toFixed(1)
    alerts.push({
      tipo: 'atencao',
      titulo: `Margem de lucro abaixo do saudável (${margin}%)`,
      descricao: `Margem atual de ${margin}% está abaixo dos 20% recomendados para seu setor. Revise precificação e custos.`,
      impacto: `${margin}% de margem`,
    })
  }

  if (latest.profit > prev.profit * 1.1) {
    const pct = (((latest.profit - prev.profit) / prev.profit) * 100).toFixed(0)
    alerts.push({
      tipo: 'oportunidade',
      titulo: `Lucro cresceu ${pct}% — momento de reinvestir`,
      descricao: `Excelente resultado. Com o lucro extra de R$${(latest.profit - prev.profit).toLocaleString('pt-BR')}, avalie reinvestimento em aquisição ou expansão de capacidade.`,
      impacto: `+R$${(latest.profit - prev.profit).toLocaleString('pt-BR')}/mês`,
    })
  }

  return alerts.slice(0, 4)
}

// ─── WhatsApp chat assistant ───────────────────────────────────
// Lightweight reply generation for incoming WhatsApp messages.
// Uses Haiku for speed and cost efficiency.

export async function generateWhatsAppReply(params: {
  userMessage: string
  senderName?: string
}): Promise<string> {
  const system = [
    'Você é um assistente de negócios especializado em ajudar empreendedores brasileiros a aumentar lucros e resolver problemas financeiros.',
    'Responda de forma direta, clara e útil.',
    'Máximo 300 caracteres por resposta — mensagem de WhatsApp.',
    'Use português brasileiro natural.',
    'Nunca use markdown, asteriscos ou formatação especial.',
    'Se não souber, diga que pode verificar no dashboard.',
  ].join(' ')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system,
    messages: [
      {
        role: 'user',
        content: params.senderName
          ? `(Usuário: ${params.senderName}) ${params.userMessage}`
          : params.userMessage,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return text || 'Olá! Recebi sua mensagem. Como posso ajudar?'
}
