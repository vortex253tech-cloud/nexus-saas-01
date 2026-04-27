// ─── AI Decision Engine ───────────────────────────────────────────────────────
// Uses rule-based logic first (free), Claude Haiku fallback (cheap).
// Set ANTHROPIC_API_KEY to enable AI path.

import Anthropic from '@anthropic-ai/sdk'

export interface DecisionInput {
  context:    Record<string, unknown>
  lastOutput: unknown
  prompt:     string
  threshold?: number
}

export interface DecisionOutput {
  proceed:    boolean
  confidence: number   // 0.0 – 1.0
  reasoning:  string
  action?:    string
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function decideNextAction(input: DecisionInput): Promise<DecisionOutput> {
  // Rule-based first — fast, deterministic, zero cost
  const ruleResult = evaluateRules(input)
  if (ruleResult) return ruleResult

  // AI fallback — only when ANTHROPIC_API_KEY is set
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await aiDecision(input)
    } catch {
      // If AI fails, fall through to heuristic
    }
  }

  return heuristicDecision(input)
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

function evaluateRules(input: DecisionInput): DecisionOutput | null {
  const out = input.lastOutput as Record<string, unknown> | null

  if (!out) {
    return { proceed: false, confidence: 1.0, reasoning: 'Sem output do nó anterior — não é possível prosseguir' }
  }

  if (typeof out.count === 'number' && out.count === 0) {
    return { proceed: false, confidence: 1.0, reasoning: 'Dataset vazio — pulando ações downstream' }
  }

  if (input.threshold !== undefined && typeof out.count === 'number') {
    return {
      proceed:    out.count >= input.threshold,
      confidence: 0.9,
      reasoning:  `Contagem ${out.count} vs threshold ${input.threshold}`,
    }
  }

  const summary = out.summary as Record<string, number> | undefined
  if (summary?.profit !== undefined && summary.profit < 0) {
    return { proceed: true, confidence: 0.95, reasoning: `Margem negativa (${summary.profit}) — ação corretiva necessária`, action: 'corrective' }
  }

  if (summary?.total_overdue !== undefined && summary.total_overdue > 0) {
    return { proceed: true, confidence: 0.9, reasoning: `Inadimplência de ${summary.total_overdue} detectada — prosseguindo`, action: 'recovery' }
  }

  return null
}

// ─── Claude Haiku AI decision ─────────────────────────────────────────────────

async function aiDecision(input: DecisionInput): Promise<DecisionOutput> {
  const client = new Anthropic()

  const contextSummary = JSON.stringify({
    lastOutput:  input.lastOutput,
    flowContext: input.context?.flowContext ?? input.context,
  }, null, 2).slice(0, 2000)

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        'Você é um motor de decisão de negócios. Analise o contexto e decida se o fluxo deve prosseguir.',
        '',
        `Contexto:\n${contextSummary}`,
        '',
        `Decisão solicitada: ${input.prompt}`,
        '',
        'Responda APENAS com JSON (sem markdown):',
        '{ "proceed": boolean, "confidence": number 0-1, "reasoning": "string em português", "action": "optional string" }',
      ].join('\n'),
    }],
  })

  const text   = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  const clean  = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(clean) as Partial<DecisionOutput>

  return {
    proceed:    parsed.proceed    ?? false,
    confidence: parsed.confidence ?? 0.5,
    reasoning:  parsed.reasoning  ?? 'Decisão por IA',
    action:     parsed.action,
  }
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────

function heuristicDecision(input: DecisionInput): DecisionOutput {
  const out = input.lastOutput as Record<string, unknown> | null

  const hasRecords =
    (typeof out?.count === 'number' && out.count > 0) ||
    (Array.isArray(out?.records) && (out.records as unknown[]).length > 0)

  return {
    proceed:    hasRecords,
    confidence: 0.6,
    reasoning:  hasRecords ? 'Dados disponíveis — prosseguindo por heurística' : 'Sem dados — pausando por heurística',
  }
}
