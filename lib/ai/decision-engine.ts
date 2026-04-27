// ─── AI Decision Engine ───────────────────────────────────────────────────────
// Phase 1: Rule-based logic (deterministic, testable, no token cost)
// Phase 2: Ready to plug Claude in — see commented section at the bottom

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
  action?:    string   // optional qualifier ('corrective', 'opportunistic', etc.)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function decideNextAction(input: DecisionInput): Promise<DecisionOutput> {
  // Try deterministic rules first — fast and free
  const ruleResult = evaluateRules(input)
  if (ruleResult) return ruleResult

  // Fall back to heuristic
  return heuristicDecision(input)
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

function evaluateRules(input: DecisionInput): DecisionOutput | null {
  const out = input.lastOutput as Record<string, unknown> | null

  if (!out) {
    return {
      proceed:    false,
      confidence: 1.0,
      reasoning:  'No output from previous node — cannot proceed',
    }
  }

  // Rule 1: empty dataset — no point continuing
  if (typeof out.count === 'number' && out.count === 0) {
    return {
      proceed:    false,
      confidence: 1.0,
      reasoning:  'Dataset is empty — skipping downstream actions',
    }
  }

  // Rule 2: threshold check
  if (input.threshold !== undefined && typeof out.count === 'number') {
    return {
      proceed:    out.count >= input.threshold,
      confidence: 0.9,
      reasoning:  `Count ${out.count} vs threshold ${input.threshold}`,
    }
  }

  // Rule 3: negative profit → corrective flow
  const summary = out.summary as Record<string, number> | undefined
  if (summary?.profit !== undefined && summary.profit < 0) {
    return {
      proceed:    true,
      confidence: 0.95,
      reasoning:  `Negative profit detected (${summary.profit}) — triggering corrective action`,
      action:     'corrective',
    }
  }

  // Rule 4: high overdue total
  if (summary?.total_overdue !== undefined && summary.total_overdue > 0) {
    return {
      proceed:    true,
      confidence: 0.9,
      reasoning:  `${summary.total_overdue} overdue amount found — proceeding`,
      action:     'recovery',
    }
  }

  return null  // no rule matched — fall through to heuristic
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
    reasoning:  hasRecords
      ? 'Data available — proceeding with default heuristic'
      : 'No data found — halting by default heuristic',
  }
}

// ─── Phase 2: AI-powered decisions (enable when ready) ───────────────────────
//
// Replace heuristicDecision with aiDecision when you want Claude to reason
// about the context. Claude Haiku costs ~$0.00025 per 1k tokens.
//
// import Anthropic from '@anthropic-ai/sdk'
//
// async function aiDecision(input: DecisionInput): Promise<DecisionOutput> {
//   const client  = new Anthropic()
//   const context = JSON.stringify({ lastOutput: input.lastOutput, vars: input.context })
//
//   const msg = await client.messages.create({
//     model: 'claude-haiku-4-5-20251001',
//     max_tokens: 256,
//     messages: [{
//       role: 'user',
//       content: [
//         `Você é um motor de decisão de negócios. Analise o contexto e responda JSON:`,
//         `Contexto: ${context}`,
//         `Decisão solicitada: ${input.prompt}`,
//         `Responda APENAS com JSON: { "proceed": boolean, "confidence": number, "reasoning": string }`,
//       ].join('\n'),
//     }],
//   })
//
//   const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
//   const parsed = JSON.parse(text) as Partial<DecisionOutput>
//   return {
//     proceed:    parsed.proceed ?? false,
//     confidence: parsed.confidence ?? 0.5,
//     reasoning:  parsed.reasoning ?? 'AI decision',
//   }
// }
