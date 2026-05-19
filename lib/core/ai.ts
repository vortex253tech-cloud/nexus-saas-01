// NEXUS Core Engine — AI Executor
// Central Claude executor. All AI calls in the platform funnel through here.
// Logs every call to engine_action_logs for auditability.

import Anthropic        from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { emitEvent }    from './event-bus'
import type { NexusAction, ActionResult } from './types'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Core AI call ─────────────────────────────────────────────────────────────

export interface AICallOptions {
  company_id:  string
  system:      string
  messages:    Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens?: number
  model?:      string
  action_type?: string
  metadata?:   Record<string, unknown>
}

export interface AICallResult {
  text:         string
  input_tokens: number
  output_tokens: number
  model:        string
  duration_ms:  number
}

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic()
  const model  = opts.model ?? 'claude-sonnet-4-6'
  const start  = Date.now()

  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? 1024,
    system:     opts.system,
    messages:   opts.messages,
  })

  const duration_ms    = Date.now() - start
  const text           = (response.content[0] as { type: string; text: string })?.text ?? ''
  const input_tokens   = response.usage?.input_tokens  ?? 0
  const output_tokens  = response.usage?.output_tokens ?? 0

  // Log to engine_action_logs (best effort)
  db()
    .from('engine_action_logs')
    .insert({
      company_id:   opts.company_id,
      action_type:  opts.action_type ?? 'ai_call',
      status:       'completed',
      payload:      {
        model,
        input_tokens,
        output_tokens,
        duration_ms,
        ...(opts.metadata ?? {}),
      },
      result:       { text_length: text.length },
      created_at:   new Date().toISOString(),
    })
    .then(() => {}, () => {})

  return { text, input_tokens, output_tokens, model, duration_ms }
}

// ─── Action dispatcher ────────────────────────────────────────────────────────

export async function executeAction(action: NexusAction): Promise<ActionResult> {
  const start = Date.now()

  try {
    let result: Record<string, unknown> = {}

    switch (action.type) {
      case 'generate_content': {
        const aiResult = await callAI({
          company_id:  action.company_id,
          system:      (action.payload.system as string) ?? 'Você é um assistente de marketing.',
          messages:    (action.payload.messages as AICallOptions['messages']) ?? [],
          max_tokens:  (action.payload.max_tokens as number) ?? 1024,
          action_type: 'generate_content',
          metadata:    { content_type: action.payload.content_type },
        })
        result = { content: aiResult.text }
        break
      }

      case 'analyze_lead': {
        const aiResult = await callAI({
          company_id:  action.company_id,
          system: `Você é um especialista em análise de leads. Analise o lead e retorne um JSON com:
- score (0-100)
- temperatura (cold/warm/hot)
- proxima_acao (string)
- motivo (string)
Responda APENAS com JSON válido.`,
          messages: [{
            role:    'user',
            content: `Dados do lead: ${JSON.stringify(action.payload.lead)}`,
          }],
          max_tokens:  512,
          action_type: 'analyze_lead',
        })
        try {
          result = { analysis: JSON.parse(aiResult.text) }
        } catch {
          result = { analysis: { score: 50, temperatura: 'warm', proxima_acao: 'Follow-up', motivo: aiResult.text } }
        }
        break
      }

      case 'run_automation': {
        // Delegate to automations engine
        const { runAutomationById } = await import('./automations')
        result = await runAutomationById(
          action.company_id,
          action.payload.automation_id as string,
          action.payload.context as Record<string, unknown>,
        )
        break
      }

      default:
        result = { message: `Action ${action.type} acknowledged` }
    }

    // Emit completion event
    await emitEvent('ai.action.completed', action.company_id, {
      action_type: action.type,
      duration_ms: Date.now() - start,
      ...result,
    }, 'ai-engine')

    return { success: true, data: result, action: action.type }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)

    await emitEvent('ai.action.failed', action.company_id, {
      action_type: action.type,
      error,
    }, 'ai-engine')

    return { success: false, error, action: action.type }
  }
}

// ─── Dispatch a voice/chat command from NEXUS ─────────────────────────────────

export async function dispatchCommand(
  company_id: string,
  command:    string,
  context?:   Record<string, unknown>,
): Promise<string> {
  const result = await callAI({
    company_id,
    system: `Você é NEXUS, o COO de IA do negócio. Recebeu um comando e deve responder com uma ação específica ou informação.
Seja direto, executivo, máximo 3 frases.`,
    messages: [{ role: 'user', content: context ? `Contexto: ${JSON.stringify(context)}\n\nComando: ${command}` : command }],
    max_tokens:  300,
    action_type: 'dispatch_command',
  })

  await emitEvent('assistant.command', company_id, { command, response: result.text }, 'ai-engine')

  return result.text
}
