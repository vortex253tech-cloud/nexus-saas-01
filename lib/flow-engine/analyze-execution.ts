// ─── Execution Analyzer — Auto-Optimization ───────────────────────────────────
// After execution, uses AI to suggest flow improvements.
// Saves suggestions to the flow_insights table.
// SERVER-ONLY.

import Anthropic                  from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase'
import type { StepLog }           from './types'

export interface ExecutionInsight {
  type:        'warning' | 'improvement' | 'info'
  title:       string
  description: string
  priority:    'high' | 'medium' | 'low'
}

export interface AnalysisResult {
  executionId: string
  insights:    ExecutionInsight[]
  score:       number   // 0-100 health score for this execution
  savedAt:     string
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function analyzeExecution(
  executionId: string,
  flowId:      string,
  companyId:   string,
  logs:        StepLog[],
  output:      unknown,
): Promise<AnalysisResult> {
  const insights = await generateInsights(logs, output)
  const score    = computeScore(logs)
  const savedAt  = new Date().toISOString()

  // Persist to flow_insights table (best-effort — don't fail the caller)
  try {
    const db = getSupabaseServerClient()
    await db.from('flow_insights').insert({
      execution_id: executionId,
      flow_id:      flowId,
      company_id:   companyId,
      score,
      insights,
      created_at:   savedAt,
    })
  } catch {
    // Non-critical — silently skip if table doesn't exist yet
  }

  return { executionId, insights, score, savedAt }
}

// ─── Score calculator ─────────────────────────────────────────────────────────

function computeScore(logs: StepLog[]): number {
  if (logs.length === 0) return 0

  const total   = logs.length
  const success = logs.filter(l => l.status === 'success').length
  const errors  = logs.filter(l => l.status === 'error').length
  const skipped = logs.filter(l => l.status === 'skipped').length

  let score = Math.round((success / total) * 100)

  // Deduct for errors
  score -= errors * 15

  // Slight deduction for high skip rate (> 50% skipped suggests bad branching)
  if (skipped / total > 0.5) score -= 10

  return Math.max(0, Math.min(100, score))
}

// ─── AI insight generator ─────────────────────────────────────────────────────

async function generateInsights(
  logs:   StepLog[],
  output: unknown,
): Promise<ExecutionInsight[]> {
  const staticInsights = buildStaticInsights(logs, output)

  if (!process.env.ANTHROPIC_API_KEY) return staticInsights

  try {
    return await aiInsights(logs, output, staticInsights)
  } catch {
    return staticInsights
  }
}

// ─── Static (rule-based) insights ────────────────────────────────────────────

function buildStaticInsights(logs: StepLog[], output: unknown): ExecutionInsight[] {
  const insights: ExecutionInsight[] = []
  const errors    = logs.filter(l => l.status === 'error')
  const skipped   = logs.filter(l => l.status === 'skipped')
  const out       = output as Record<string, unknown> | null

  if (errors.length > 0) {
    insights.push({
      type:        'warning',
      title:       `${errors.length} nó(s) com erro`,
      description: `Tipos com erro: ${[...new Set(errors.map(e => e.nodeType))].join(', ')}. Verifique a configuração desses nós.`,
      priority:    'high',
    })
  }

  if (skipped.length > logs.length * 0.5 && logs.length > 2) {
    insights.push({
      type:        'improvement',
      title:       'Alta taxa de nós pulados',
      description: `${skipped.length} de ${logs.length} nós foram pulados. Revise as condições de decisão para evitar fluxos ociosos.`,
      priority:    'medium',
    })
  }

  const emailsSent   = Number(out?.emailsSent   ?? 0)
  const whatsappSent = Number(out?.whatsappSent ?? 0)

  if (emailsSent === 0 && whatsappSent === 0) {
    const hasActionNode = logs.some(l => l.nodeType === 'ACTION')
    if (hasActionNode) {
      insights.push({
        type:        'warning',
        title:       'Nenhuma mensagem enviada',
        description: 'O fluxo tem nós de ação mas nenhuma mensagem foi enviada. Verifique se os registros de destino têm email/telefone e se o nó de análise retornou dados.',
        priority:    'high',
      })
    }
  }

  const slowLogs = logs.filter(l => l.durationMs > 5000)
  if (slowLogs.length > 0) {
    insights.push({
      type:        'improvement',
      title:       'Nós lentos detectados',
      description: `${slowLogs.length} nó(s) demoraram mais de 5s: ${slowLogs.map(l => l.nodeType).join(', ')}. Considere otimizar consultas.`,
      priority:    'low',
    })
  }

  if (emailsSent > 0) {
    insights.push({
      type:        'info',
      title:       `${emailsSent} email(s) enviado(s) com sucesso`,
      description: 'Monitore respostas e conversões para medir o ROI do fluxo.',
      priority:    'low',
    })
  }

  return insights
}

// ─── AI-enhanced insights ─────────────────────────────────────────────────────

async function aiInsights(
  logs:           StepLog[],
  output:         unknown,
  staticInsights: ExecutionInsight[],
): Promise<ExecutionInsight[]> {
  const client = new Anthropic()

  const summary = {
    totalSteps:  logs.length,
    errors:      logs.filter(l => l.status === 'error').length,
    skipped:     logs.filter(l => l.status === 'skipped').length,
    nodeTypes:   [...new Set(logs.map(l => l.nodeType))],
    output:      output,
    errorMsgs:   logs.filter(l => l.status === 'error').map(l => l.message).filter(Boolean),
  }

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        'Você é um analista de automação de negócios. Analise os dados de execução de fluxo e gere insights de melhoria.',
        '',
        `Dados da execução:\n${JSON.stringify(summary, null, 2)}`,
        '',
        'Gere 1-2 insights adicionais (além dos já identificados) para melhorar o fluxo.',
        'Responda APENAS com JSON (sem markdown):',
        '[{ "type": "warning|improvement|info", "title": "string", "description": "string em português", "priority": "high|medium|low" }]',
      ].join('\n'),
    }],
  })

  const text   = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const clean  = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const aiList = JSON.parse(clean) as ExecutionInsight[]

  return [...staticInsights, ...aiList.slice(0, 2)]
}
