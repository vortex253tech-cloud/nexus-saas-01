import { ActionHandlerService }   from '../action-handler.service'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'
import type { ActionContext }       from '../actions/action.types'

// ─── Action handler ───────────────────────────────────────────────────────────
// Thin adapter between the FlowEngine and ActionHandlerService.
// Derives actionType from canvas config when no explicit type is set.

export async function handleAction(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config     = node.config as Record<string, unknown>
  const actionType = resolveActionType(config)

  // Enrich config from canvas node fields so send-email / send-whatsapp
  // can find subject, message, channel-specific defaults.
  const enrichedConfig = enrichConfig(config, actionType, node)

  const context: ActionContext = {
    companyId:   ctx.companyId,
    executionId: ctx.executionId,
    flowId:      ctx.flowId,
    lastOutput:  ctx.lastOutput,
    variables:   ctx.variables,
  }

  const svc    = new ActionHandlerService()
  const result = await svc.executeAction(actionType, enrichedConfig, context)

  return {
    success: result.success,
    output:  {
      actionType,
      processed: result.processed,
      succeeded: result.succeeded,
      errors:    result.errors,
      payload:   result.payload,
      sent:      result.succeeded,   // for result.handler whatsapp counter
      channel:   enrichedConfig.channel ?? 'email',
    },
    message: result.message,
  }
}

// ─── Resolve action type ──────────────────────────────────────────────────────
// Canvas `auto_action` nodes store { channel, segment, messageType } but no
// explicit actionType.  Map channel → action type here.

function resolveActionType(config: Record<string, unknown>): string {
  // Explicit wins always
  if (typeof config.actionType === 'string' && config.actionType) {
    return config.actionType
  }

  // Derive from canvas channel field
  const channel = (config.channel as string | undefined)?.toLowerCase()
  if (channel === 'whatsapp') return 'SEND_WHATSAPP'
  if (channel === 'email')    return 'SEND_EMAIL'

  // Legacy / unknown → safe no-op
  return 'create_log'
}

// ─── Enrich config from canvas node data ─────────────────────────────────────

function enrichConfig(
  config:     Record<string, unknown>,
  actionType: string,
  node:       FlowNode,
): Record<string, unknown> {
  const label       = node.label ?? (node.data?.label as string | undefined) ?? ''
  const messageType = (config.messageType as string | undefined) ?? 'campaign'
  const segment     = (config.segment     as string | undefined) ?? 'all'

  if (actionType === 'SEND_EMAIL') {
    return {
      ...config,
      subject:  config.subject  ?? buildSubject(messageType, label),
      template: config.template ?? buildEmailTemplate(messageType, segment),
      saveToMessages: true,
    }
  }

  if (actionType === 'SEND_WHATSAPP') {
    return {
      ...config,
      message: config.message ?? buildWhatsAppMessage(messageType, segment),
      saveToMessages: true,
    }
  }

  return config
}

// ─── Default content per message type ────────────────────────────────────────

function buildSubject(messageType: string, label: string): string {
  switch (messageType) {
    case 'recovery':     return '⚠️ Pendência financeira — ação necessária'
    case 'upsell':       return '📈 Oferta especial para você'
    case 'reactivation': return '🔄 Sentimos sua falta!'
    default:             return label || '📣 Novidades para você'
  }
}

function buildEmailTemplate(messageType: string, _segment: string): string {
  switch (messageType) {
    case 'recovery':
      return `<p>Olá <strong>{{nome}}</strong>,</p>
<p>Identificamos uma pendência em sua conta. Por favor, entre em contato para regularizar.</p>
<p>Valor em aberto: <strong>{{amount}}</strong></p>
<p>Entre em contato conosco para mais informações.</p>`

    case 'upsell':
      return `<p>Olá <strong>{{nome}}</strong>,</p>
<p>Com base no seu histórico, identificamos uma oportunidade especial para você.</p>
<p>Gostaria de conhecer nossos planos premium com benefícios exclusivos?</p>`

    case 'reactivation':
      return `<p>Olá <strong>{{nome}}</strong>,</p>
<p>Faz tempo que não falamos. Sentimos sua falta!</p>
<p>Temos novidades e gostaríamos de compartilhá-las com você.</p>`

    default:
      return `<p>Olá <strong>{{nome}}</strong>,</p>
<p>Temos novidades importantes para você.</p>
<p>Entre em contato para saber mais.</p>`
  }
}

function buildWhatsAppMessage(messageType: string, _segment: string): string {
  switch (messageType) {
    case 'recovery':
      return 'Olá {{nome}}! Identificamos uma pendência em sua conta. Entre em contato para regularizar. Estamos aqui para ajudar! 🤝'
    case 'upsell':
      return 'Olá {{nome}}! Temos uma oferta especial para você baseada no seu perfil. Quer saber mais? 📈'
    case 'reactivation':
      return 'Olá {{nome}}! Sentimos sua falta! Temos novidades incríveis e gostaríamos de te contar. Pode falar? 😊'
    default:
      return 'Olá {{nome}}! Temos novidades importantes para você. Entre em contato! 👋'
  }
}
