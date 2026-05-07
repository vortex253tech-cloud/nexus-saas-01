// lib/engine-actions.ts — NEXUS Revenue Engine: Action Execution Layer
//
// Bridges Decision objects (from decision-engine) into stored + executed actions.
// Also provides direct action primitives that log timestamp/user_id/outcome.
//
// Architecture:
//   Decision → decisionToAction() → actions table → executor.ts → execution_history

import { getSupabaseServerClient } from '@/lib/supabase'
import { sendEmail, buildActionEmailHTML } from '@/lib/email'
import { sendWhatsApp, buildWhatsAppMessage } from '@/lib/whatsapp'
import type { Decision } from '@/lib/decision-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionLog {
  action_id:  string
  company_id: string
  trigger:    string
  channel:    string
  status:     'success' | 'failed' | 'skipped'
  outcome:    string
  ganho:      number
  timestamp:  string
  metadata?:  Record<string, unknown>
}

export interface DirectActionResult {
  success:   boolean
  channel:   string
  message_id?: string
  error?:    string
  simulated?: boolean
  timestamp: string
}

// ─── Decision → Action row ────────────────────────────────────────────────────

export function decisionToActionRow(decision: Decision, companyId: string) {
  const priorityMap: Record<number, 'critica' | 'alta' | 'media'> = {
    1: 'critica',
    2: 'alta',
    3: 'alta',
    4: 'media',
    5: 'media',
  }
  const urgencyMap: Record<number, 'alta' | 'media' | 'baixa'> = {
    1: 'alta',
    2: 'alta',
    3: 'media',
    4: 'media',
    5: 'baixa',
  }
  const iconMap: Record<string, string> = {
    RECOVERY_FLOW:     '💸',
    SALES_FLOW:        '🎯',
    REACTIVATION_FLOW: '🔄',
    COLLECTION_FLOW:   '📊',
    UPSELL_FLOW:       '📈',
  }

  return {
    company_id:       companyId,
    titulo:           decision.title,
    descricao:        decision.rationale,
    detalhe:          decision.recommended_action,
    impacto_estimado: Math.round(decision.expected_revenue_impact),
    prioridade:       priorityMap[decision.priority] ?? 'media',
    urgencia:         urgencyMap[decision.priority] ?? 'media',
    icone:            iconMap[decision.trigger] ?? '⚡',
    execution_type:   decision.execution_type,
    auto_executable:  decision.auto_executable,
    effort_level:     decision.priority <= 2 ? 'low' : 'medium',
    passos:           buildSteps(decision),
    status:           'pending',
    ganho_realizado:  0,
    metadata:         decision.metadata,
    // tag for dedup — engine decisions are tagged so we don't re-create them each run
    source_trigger:   decision.trigger,
  }
}

function buildSteps(decision: Decision): string[] {
  switch (decision.trigger) {
    case 'RECOVERY_FLOW':
      return [
        'O sistema enviará e-mails de cobrança personalizados',
        'Sequência: D+1 lembrete, D+3 alerta, D+7 escalation',
        'Acompanhe as respostas no painel de clientes',
      ]
    case 'SALES_FLOW':
      return [
        'Follow-up personalizado enviado para leads quentes',
        'Mensagem usa histórico de interações do lead',
        'Monitore conversões nas próximas 48h',
      ]
    case 'REACTIVATION_FLOW':
      return [
        'Campanha de reativação disparada por e-mail',
        'Clientes inativos recebem oferta personalizada',
        'Acompanhe reativações no relatório semanal',
      ]
    case 'COLLECTION_FLOW':
      return [
        'Ative a régua automática de cobrança em Configurações',
        'Configure: D+1 lembrete, D+3 alerta, D+7 escalation',
        'Monitore a taxa de inadimplência no dashboard financeiro',
      ]
    case 'UPSELL_FLOW':
      return [
        'Oferta de upgrade enviada para clientes premium',
        'Proposta baseada no histórico de pagamentos',
        'Acompanhe aceitação no relatório de receita',
      ]
    default:
      return ['Executar ação conforme recomendação']
  }
}

// ─── Persist decisions as actions (dedup by source_trigger + pending) ─────────

export async function persistDecisions(
  decisions: Decision[],
  companyId: string
): Promise<{ inserted: number; skipped: number }> {
  const db = getSupabaseServerClient()

  // Find existing pending actions from the engine (source_trigger tagged)
  const { data: existing } = await db
    .from('actions')
    .select('source_trigger')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .not('source_trigger', 'is', null)

  const existingTriggers = new Set((existing ?? []).map(r => r.source_trigger as string))

  let inserted = 0
  let skipped  = 0

  for (const decision of decisions) {
    if (existingTriggers.has(decision.trigger)) {
      skipped++
      continue
    }
    const row = decisionToActionRow(decision, companyId)
    const { error } = await db.from('actions').insert(row)
    if (!error) inserted++
    else console.error('[engine-actions] insert error:', error.message)
  }

  return { inserted, skipped }
}

// ─── Direct action primitives ─────────────────────────────────────────────────

export async function engineSendEmail(params: {
  companyId: string
  to:        string
  subject:   string
  html:      string
  actionId?: string
  trigger?:  string
  userId?:   string
}): Promise<DirectActionResult> {
  const timestamp = new Date().toISOString()

  const result = await sendEmail({ to: params.to, subject: params.subject, html: params.html })

  await logDirectAction({
    action_id:  params.actionId ?? 'direct',
    company_id: params.companyId,
    trigger:    params.trigger ?? 'manual',
    channel:    'email',
    status:     result.success ? 'success' : 'failed',
    outcome:    result.success ? `Email entregue para ${params.to}` : `Falhou: ${result.error}`,
    ganho:      0,
    timestamp,
    metadata:   { to: params.to, message_id: result.id, simulated: result.simulated },
  })

  return {
    success:    result.success,
    channel:    'email',
    message_id: result.id,
    error:      result.error,
    simulated:  result.simulated,
    timestamp,
  }
}

export async function engineSendWhatsApp(params: {
  companyId: string
  phone:     string
  message:   string
  actionId?: string
  trigger?:  string
  userId?:   string
}): Promise<DirectActionResult> {
  const timestamp = new Date().toISOString()

  const result = await sendWhatsApp({ phone: params.phone, message: params.message })

  await logDirectAction({
    action_id:  params.actionId ?? 'direct',
    company_id: params.companyId,
    trigger:    params.trigger ?? 'manual',
    channel:    'whatsapp',
    status:     result.success ? 'success' : 'failed',
    outcome:    result.success ? `WhatsApp entregue para ${params.phone}` : `Falhou: ${result.error}`,
    ganho:      0,
    timestamp,
    metadata:   { phone: params.phone, message_id: result.messageId, simulated: result.simulated },
  })

  return {
    success:    result.success,
    channel:    'whatsapp',
    message_id: result.messageId,
    error:      result.error,
    simulated:  result.simulated,
    timestamp,
  }
}

export async function generatePaymentLink(params: {
  companyId: string
  clientId:  string
  amount:    number
  dueDate?:  string
  actionId?: string
  userId?:   string
}): Promise<DirectActionResult & { link?: string }> {
  const timestamp = new Date().toISOString()
  const db = getSupabaseServerClient()

  // Generate a tracked payment link (using existing invoice/client data)
  const { data: client } = await db
    .from('clients')
    .select('name, email')
    .eq('id', params.clientId)
    .eq('company_id', params.companyId)
    .single()

  const link = client
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pay/${params.companyId}/${params.clientId}`
    : undefined

  await logDirectAction({
    action_id:  params.actionId ?? 'direct',
    company_id: params.companyId,
    trigger:    'PAYMENT_LINK',
    channel:    'link',
    status:     link ? 'success' : 'failed',
    outcome:    link ? `Link gerado para ${client?.name ?? params.clientId}` : 'Cliente não encontrado',
    ganho:      params.amount,
    timestamp,
    metadata:   { client_id: params.clientId, amount: params.amount, due_date: params.dueDate },
  })

  return { success: !!link, channel: 'link', link, timestamp }
}

export async function createFollowUp(params: {
  companyId:   string
  clientId?:   string
  leadId?:     string
  scheduledAt: string  // ISO
  note:        string
  actionId?:   string
  userId?:     string
}): Promise<DirectActionResult> {
  const timestamp = new Date().toISOString()
  const db = getSupabaseServerClient()

  // Log the follow-up in execution_history for tracking
  await db.from('execution_history').insert({
    company_id:     params.companyId,
    action_id:      params.actionId ?? 'followup',
    titulo:         `Follow-up agendado`,
    execution_type: 'recommendation',
    ganho_realizado: 0,
    execution_log:  `[${timestamp}] Follow-up criado: "${params.note}" para ${params.scheduledAt}`,
    executed_at:    timestamp,
  })

  await logDirectAction({
    action_id:  params.actionId ?? 'direct',
    company_id: params.companyId,
    trigger:    'FOLLOW_UP',
    channel:    'internal',
    status:     'success',
    outcome:    `Follow-up agendado para ${params.scheduledAt}: ${params.note}`,
    ganho:      0,
    timestamp,
    metadata:   { client_id: params.clientId, lead_id: params.leadId, scheduled_at: params.scheduledAt },
  })

  return { success: true, channel: 'internal', timestamp }
}

export async function triggerAutomationFlow(params: {
  companyId:  string
  flowType:   'recovery' | 'sales' | 'reactivation' | 'upsell' | 'collection'
  targetIds:  string[]  // client or lead IDs
  actionId?:  string
  userId?:    string
}): Promise<DirectActionResult & { queued: number }> {
  const timestamp = new Date().toISOString()
  const db = getSupabaseServerClient()

  // Queue automation flow entries for the flow-queue cron to pick up
  const rows = params.targetIds.map(targetId => ({
    company_id:  params.companyId,
    flow_type:   params.flowType,
    target_id:   targetId,
    status:      'queued',
    created_at:  timestamp,
    trigger_source: params.actionId ?? 'engine',
  }))

  let queued = 0
  if (rows.length > 0) {
    const { data, error } = await db.from('automation_flows').insert(rows).select('id')
    if (!error) queued = data?.length ?? 0
  }

  await logDirectAction({
    action_id:  params.actionId ?? 'direct',
    company_id: params.companyId,
    trigger:    `AUTOMATION_${params.flowType.toUpperCase()}`,
    channel:    'automation',
    status:     queued > 0 ? 'success' : 'failed',
    outcome:    `${queued}/${params.targetIds.length} registros enfileirados para flow ${params.flowType}`,
    ganho:      0,
    timestamp,
    metadata:   { flow_type: params.flowType, target_count: params.targetIds.length, queued },
  })

  return { success: queued > 0, channel: 'automation', queued, timestamp }
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function logDirectAction(log: ActionLog): Promise<void> {
  try {
    const db = getSupabaseServerClient()
    await db.from('engine_action_logs').insert({
      action_id:  log.action_id,
      company_id: log.company_id,
      trigger:    log.trigger,
      channel:    log.channel,
      status:     log.status,
      outcome:    log.outcome,
      ganho:      log.ganho,
      timestamp:  log.timestamp,
      metadata:   log.metadata ?? null,
    })
  } catch {
    // Table may not exist yet — non-blocking
  }
}

// ─── Re-export action builders for convenience ────────────────────────────────

export { buildActionEmailHTML, buildWhatsAppMessage }
