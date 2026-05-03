// ─── Supplier Intelligence Engine ────────────────────────────────────────────
// Server-side only. Scoring, analysis and AI insights for the cost module.

import Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierCost {
  id: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'one-time'
  date: string
}

export interface Supplier {
  id: string
  name: string
  category: string
  type: 'recurring' | 'one-time'
  contact_email: string | null
  contact_whatsapp: string | null
  created_at: string
  costs: SupplierCost[]
}

export type RiskLabel = 'high_cost_risk' | 'medium' | 'efficient'

export interface ScoredSupplier extends Supplier {
  monthlyCost: number
  costHistory: { date: string; amount: number }[]
  trend: 'up' | 'down' | 'stable'
  trendPct: number
  riskLabel: RiskLabel
  score: number           // 0-100: higher = higher risk/cost weight
  shareOfTotal: number    // 0-1
}

export interface SupplierInsight {
  supplier_id: string | null
  type: 'high_cost' | 'increase' | 'inefficiency' | 'dependency' | 'duplicate'
  message: string
  impact_value: number
}

export interface SupplierAnalysis {
  totalMonthlyCost: number
  savingsOpportunity: number
  insights: SupplierInsight[]
  scored: ScoredSupplier[]
  topThree: ScoredSupplier[]
  categoryBreakdown: { category: string; total: number; share: number }[]
}

// ─── Normalize cost to monthly amount ─────────────────────────────────────────

export function toMonthly(amount: number, frequency: SupplierCost['frequency']): number {
  switch (frequency) {
    case 'weekly':   return amount * 4.33
    case 'one-time': return amount / 12
    default:         return amount
  }
}

// ─── Calculate current monthly cost for a supplier ───────────────────────────

function supplierMonthlyCost(supplier: Supplier): number {
  if (!supplier.costs.length) return 0
  // Use the most recent cost entry
  const sorted = [...supplier.costs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const latest = sorted[0]
  return toMonthly(latest.amount, latest.frequency)
}

// ─── Cost trend from last 2 entries ───────────────────────────────────────────

function calcTrend(supplier: Supplier): { trend: 'up' | 'down' | 'stable'; trendPct: number } {
  const sorted = [...supplier.costs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  if (sorted.length < 2) return { trend: 'stable', trendPct: 0 }
  const prev = toMonthly(sorted[sorted.length - 2].amount, sorted[sorted.length - 2].frequency)
  const curr = toMonthly(sorted[sorted.length - 1].amount, sorted[sorted.length - 1].frequency)
  if (prev === 0) return { trend: 'stable', trendPct: 0 }
  const pct = ((curr - prev) / prev) * 100
  if (pct > 3)  return { trend: 'up',     trendPct: pct }
  if (pct < -3) return { trend: 'down',   trendPct: pct }
  return { trend: 'stable', trendPct: pct }
}

// ─── Scoring + risk labelling ─────────────────────────────────────────────────

function scoreSupplier(
  supplier: Supplier,
  totalMonthlyCost: number,
): Pick<ScoredSupplier, 'riskLabel' | 'score' | 'shareOfTotal'> {
  const monthly = supplierMonthlyCost(supplier)
  const share   = totalMonthlyCost > 0 ? monthly / totalMonthlyCost : 0
  // Score is the share expressed 0-100 (the more a supplier consumes, the riskier)
  const score   = Math.min(100, Math.round(share * 100))
  const riskLabel: RiskLabel =
    share > 0.30 ? 'high_cost_risk' :
    share > 0.15 ? 'medium' :
    'efficient'
  return { riskLabel, score, shareOfTotal: share }
}

// ─── Rule-based fast insights (no AI) ────────────────────────────────────────

function ruleBasedInsights(scored: ScoredSupplier[]): SupplierInsight[] {
  const insights: SupplierInsight[] = []

  // 1. High-cost suppliers (>30% of total spend)
  scored
    .filter(s => s.riskLabel === 'high_cost_risk')
    .forEach(s => {
      insights.push({
        supplier_id: s.id,
        type: 'high_cost',
        message: `${s.name} representa ${Math.round(s.shareOfTotal * 100)}% do seu custo total (R$ ${fmtBRL(s.monthlyCost)}/mês) — candidato prioritário para renegociação.`,
        impact_value: s.monthlyCost * 0.15, // 15% savings potential
      })
    })

  // 2. Cost increases
  scored
    .filter(s => s.trend === 'up' && s.trendPct > 10)
    .forEach(s => {
      insights.push({
        supplier_id: s.id,
        type: 'increase',
        message: `${s.name} teve aumento de ${Math.round(s.trendPct)}% no custo recente — sem renegociação o impacto anual é R$ ${fmtBRL(s.monthlyCost * (s.trendPct / 100) * 12)}.`,
        impact_value: s.monthlyCost * (s.trendPct / 100),
      })
    })

  // 3. Category dependency (>1 supplier in same category, one dominates)
  const byCategory: Record<string, ScoredSupplier[]> = {}
  scored.forEach(s => {
    byCategory[s.category] = byCategory[s.category] ?? []
    byCategory[s.category].push(s)
  })
  Object.entries(byCategory).forEach(([cat, list]) => {
    if (list.length < 2) return
    const top = list[0]
    if (top.shareOfTotal > 0.20) {
      insights.push({
        supplier_id: top.id,
        type: 'dependency',
        message: `Dependência excessiva em ${cat}: ${top.name} responde por ${Math.round(top.shareOfTotal * 100)}% dos seus custos nessa categoria — risco operacional elevado.`,
        impact_value: top.monthlyCost * 0.1,
      })
    }
    // Potential duplicate
    insights.push({
      supplier_id: null,
      type: 'duplicate',
      message: `Você tem ${list.length} fornecedores em "${cat}". Consolidar pode reduzir custo em até R$ ${fmtBRL(list.slice(1).reduce((a, s) => a + s.monthlyCost, 0) * 0.2)}/mês.`,
      impact_value: list.slice(1).reduce((a, s) => a + s.monthlyCost, 0) * 0.2,
    })
  })

  // Remove duplicates by supplier_id
  const seen = new Set<string | null>()
  return insights.filter(i => {
    const key = `${i.type}-${i.supplier_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return Math.round(v).toString()
}

// ─── AI-powered deep analysis ─────────────────────────────────────────────────

export async function aiSupplierInsights(params: {
  scored: ScoredSupplier[]
  totalMonthlyCost: number
  totalMonthlyRevenue: number
  nomeEmpresa: string
}): Promise<SupplierInsight[]> {
  if (!params.scored.length) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const supplierContext = params.scored
    .map(s =>
      `- ${s.name} [${s.category}] R$${Math.round(s.monthlyCost)}/mês | ${Math.round(s.shareOfTotal * 100)}% do total | tendência: ${s.trend} (${s.trend !== 'stable' ? s.trendPct.toFixed(0) + '%' : ''})`
    )
    .join('\n')

  const prompt = `Você é um especialista em gestão de custos e negociação com fornecedores para PMEs brasileiras.

Empresa: ${params.nomeEmpresa}
Custo total mensal: R$${Math.round(params.totalMonthlyCost)}
Receita mensal: R$${Math.round(params.totalMonthlyRevenue || 0)}
Fornecedores:
${supplierContext}

Gere exatamente 4 insights de redução de custos com valor específico em R$. Foco em ações práticas de renegociação, substituição ou eliminação.

Retorne APENAS este JSON (sem markdown):
[
  {
    "supplier_id": "<id do fornecedor afetado ou null>",
    "type": "<high_cost|increase|inefficiency|dependency|duplicate>",
    "message": "<insight em português, 1 frase com valor R$ específico>",
    "impact_value": <valor em R$ de economia potencial mensal>
  }
]`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const json = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '')
    return JSON.parse(json) as SupplierInsight[]
  } catch {
    return []
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

export function analyzeSuppliers(
  suppliers: Supplier[],
  totalMonthlyRevenue = 0,
): Omit<SupplierAnalysis, 'insights'> & { ruleInsights: SupplierInsight[] } {
  // 1. Calculate monthly cost per supplier
  const withCost = suppliers.map(s => ({
    ...s,
    monthlyCost: supplierMonthlyCost(s),
    costHistory: s.costs
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(c => ({ date: c.date, amount: toMonthly(c.amount, c.frequency) })),
    ...calcTrend(s),
    riskLabel: 'efficient' as RiskLabel,
    score: 0,
    shareOfTotal: 0,
  }))

  const totalMonthlyCost = withCost.reduce((acc, s) => acc + s.monthlyCost, 0)

  // 2. Score each supplier
  const scored: ScoredSupplier[] = withCost
    .map(s => ({ ...s, ...scoreSupplier(s, totalMonthlyCost) }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  // 3. Category breakdown
  const catMap: Record<string, number> = {}
  scored.forEach(s => { catMap[s.category] = (catMap[s.category] ?? 0) + s.monthlyCost })
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, total]) => ({
      category,
      total,
      share: totalMonthlyCost > 0 ? total / totalMonthlyCost : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // 4. Rule-based insights
  const ruleInsights = ruleBasedInsights(scored)
  const savingsOpportunity = ruleInsights.reduce((a, i) => a + i.impact_value, 0)

  return {
    totalMonthlyCost,
    savingsOpportunity,
    scored,
    topThree: scored.slice(0, 3),
    categoryBreakdown,
    ruleInsights,
  }
}
