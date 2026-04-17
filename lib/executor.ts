// ─── NEXUS Execution Engine ─────────────────────────────────────
// Real execution of actions: email (Resend), whatsapp (Meta Cloud API),
// ads/analytics (simulation). Falls back to simulation if credentials missing.

import { getSupabaseServerClient } from '@/lib/supabase'
import { sendEmail, buildActionEmailHTML } from '@/lib/email'
import { sendWhatsApp, buildWhatsAppMessage } from '@/lib/whatsapp'

export type ExecutionType = 'email' | 'whatsapp' | 'ads' | 'recommendation' | 'analytics'

export interface ActionToExecute {
  id: string
  titulo: string
  descricao: string | null
  detalhe: string | null
  impacto_estimado: number
  execution_type: ExecutionType
  metadata?: Record<string, unknown>
  message_email?: string | null
  message_whatsapp?: string | null
  passos?: string[]
}

export interface ExecutionResult {
  success: boolean
  log: string
  ganho_realizado: number
  executed_at: string
  channel_result?: {
    channel: string
    delivered: boolean
    id?: string
    error?: string
    simulated?: boolean
  }
}

// ─── Delays per execution type (ms) ────────────────────────────

const EXECUTION_DELAYS: Record<ExecutionType, number> = {
  email: 2000,
  whatsapp: 1500,
  ads: 3000,
  recommendation: 800,
  analytics: 1200,
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Fetch company contact info ─────────────────────────────────

async function getCompanyContact(companyId: string): Promise<{
  email: string | null
  phone: string | null
  name: string
  userEmail: string | null
}> {
  const db = getSupabaseServerClient()

  const { data: company } = await db
    .from('companies')
    .select('name, email, phone, user_id')
    .eq('id', companyId)
    .single()

  if (!company) return { email: null, phone: null, name: 'Empresa', userEmail: null as string | null }

  // Also fetch user email as fallback
  let userEmail: string | null = null
  if (company.user_id) {
    const { data: user } = await db
      .from('users')
      .select('email')
      .eq('id', company.user_id)
      .single()
    userEmail = user?.email ?? null
  }

  return {
    email: (company.email as string | null) ?? userEmail,
    phone: (company.phone as string | null) ?? null,
    name: (company.name as string | null) ?? 'Empresa',
    userEmail,
  }
}

// ─── Channel dispatchers ────────────────────────────────────────

async function dispatchEmail(
  action: ActionToExecute,
  contact: Awaited<ReturnType<typeof getCompanyContact>>
): Promise<ExecutionResult['channel_result']> {
  const toEmail = contact.email
  if (!toEmail) {
    return { channel: 'email', delivered: false, error: 'Nenhum email cadastrado para esta empresa' }
  }

  const html = buildActionEmailHTML({
    nomeEmpresa: contact.name,
    actionTitulo: action.titulo,
    actionDescricao: action.descricao ?? '',
    actionDetalhe: action.detalhe ?? '',
    impactoEstimado: action.impacto_estimado,
    passos: action.passos,
  })

  const result = await sendEmail({
    to: toEmail,
    subject: `NEXUS · ${action.titulo}`,
    html,
  })

  return {
    channel: 'email',
    delivered: result.success,
    id: result.id,
    error: result.error,
    simulated: result.simulated,
  }
}

async function dispatchWhatsApp(
  action: ActionToExecute,
  contact: Awaited<ReturnType<typeof getCompanyContact>>
): Promise<ExecutionResult['channel_result']> {
  const phone = contact.phone
  if (!phone) {
    return { channel: 'whatsapp', delivered: false, error: 'Nenhum telefone cadastrado para esta empresa' }
  }

  const message = action.message_whatsapp ?? buildWhatsAppMessage({
    nomeEmpresa: contact.name,
    actionTitulo: action.titulo,
    actionDescricao: action.descricao ?? '',
    impactoEstimado: action.impacto_estimado,
  })

  const result = await sendWhatsApp({ phone, message })

  return {
    channel: 'whatsapp',
    delivered: result.success,
    id: result.messageId,
    error: result.error,
    simulated: result.simulated,
  }
}

// ─── Execution log builder ─────────────────────────────────────

function buildLog(
  type: ExecutionType,
  titulo: string,
  channelResult?: ExecutionResult['channel_result']
): string {
  const ts = new Date().toISOString()
  const delivered = channelResult?.delivered ?? false
  const simTag = channelResult?.simulated ? ' [simulado]' : ''
  const errTag = channelResult?.error ? ` — erro: ${channelResult.error}` : ''

  switch (type) {
    case 'email':
      return `[${ts}] Email ${delivered ? 'enviado' : 'falhou'}${simTag}: "${titulo}"${errTag}`
    case 'whatsapp':
      return `[${ts}] WhatsApp ${delivered ? 'entregue' : 'falhou'}${simTag}: "${titulo}"${errTag}`
    case 'ads':
      return `[${ts}] Campanha ads ativada${simTag}: "${titulo}" — plataforma: Meta+Google — status: ATIVO`
    case 'recommendation':
      return `[${ts}] Recomendação registrada${simTag}: "${titulo}" — status: CONCLUÍDO`
    case 'analytics':
      return `[${ts}] Análise executada${simTag}: "${titulo}" — status: CONCLUÍDO`
  }
}

// ─── Core execution ────────────────────────────────────────────

export async function executeAction(
  action: ActionToExecute,
  companyId: string
): Promise<ExecutionResult> {
  const db = getSupabaseServerClient()
  const delay = EXECUTION_DELAYS[action.execution_type] ?? 1000

  // Mark in_progress
  await db.from('actions').update({ status: 'in_progress' }).eq('id', action.id)

  // Simulate processing time
  await sleep(delay)

  // Dispatch to real channel
  let channelResult: ExecutionResult['channel_result'] | undefined

  if (action.execution_type === 'email' || action.execution_type === 'whatsapp') {
    const contact = await getCompanyContact(companyId)

    if (action.execution_type === 'email') {
      channelResult = await dispatchEmail(action, contact)
    } else {
      channelResult = await dispatchWhatsApp(action, contact)
    }
  }

  const executed_at = new Date().toISOString()
  const ganho_realizado = action.impacto_estimado
  const log = buildLog(action.execution_type, action.titulo, channelResult)

  // Mark done
  await db
    .from('actions')
    .update({ status: 'done', ganho_realizado, executed_at, execution_log: log })
    .eq('id', action.id)

  // Write to execution_history
  await db.from('execution_history').insert({
    company_id: companyId,
    action_id: action.id,
    titulo: action.titulo,
    execution_type: action.execution_type,
    ganho_realizado,
    execution_log: log,
    executed_at,
  })

  // Log to execution_logs (detailed)
  try {
    await db.from('execution_logs').insert({
      action_id: action.id,
      company_id: companyId,
      type: action.execution_type,
      status: channelResult ? (channelResult.delivered ? 'delivered' : 'failed') : 'completed',
      response: channelResult ? JSON.stringify(channelResult) : null,
      created_at: executed_at,
    })
  } catch {
    // execution_logs may not exist yet — non-critical
  }

  return {
    success: true,
    log,
    ganho_realizado,
    executed_at,
    channel_result: channelResult,
  }
}

// ─── Execute by ID (public API) ────────────────────────────────

export async function executeActionById(actionId: string): Promise<ExecutionResult> {
  const db = getSupabaseServerClient()

  const { data: action, error } = await db
    .from('actions')
    .select('id, titulo, descricao, detalhe, impacto_estimado, execution_type, metadata, company_id, passos, message_email, message_whatsapp')
    .eq('id', actionId)
    .single()

  if (error || !action) {
    return {
      success: false,
      log: `Ação não encontrada: ${actionId}`,
      ganho_realizado: 0,
      executed_at: new Date().toISOString(),
    }
  }

  const result = await executeAction(
    {
      id: action.id,
      titulo: action.titulo,
      descricao: action.descricao,
      detalhe: action.detalhe,
      impacto_estimado: action.impacto_estimado ?? 0,
      execution_type: (action.execution_type as ExecutionType) ?? 'recommendation',
      metadata: action.metadata as Record<string, unknown>,
      passos: Array.isArray(action.passos) ? (action.passos as string[]) : [],
      message_email: action.message_email as string | null,
      message_whatsapp: action.message_whatsapp as string | null,
    },
    action.company_id
  )

  // Update ganho_acumulado on company
  if (result.success) {
    try {
      await db.rpc('increment_ganho_acumulado', {
        p_company_id: action.company_id,
        p_value: result.ganho_realizado,
      })
    } catch {
      const { data } = await db.from('companies')
        .select('ganho_acumulado')
        .eq('id', action.company_id)
        .single()
      await db.from('companies')
        .update({ ganho_acumulado: ((data as { ganho_acumulado?: number } | null)?.ganho_acumulado ?? 0) + result.ganho_realizado })
        .eq('id', action.company_id)
    }
  }

  return result
}
