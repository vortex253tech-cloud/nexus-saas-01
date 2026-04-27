import type { FlowNode, ExecutionContext, NodeResult } from '../types'

interface MessageGenConfig {
  messageType?: 'recovery' | 'upsell' | 'reactivation' | 'campaign'
  channel?:     'email' | 'whatsapp'
  tone?:        string
  template?:    string   // custom template override
}

// ─── Message Gen handler ──────────────────────────────────────────────────────
// Takes the record set from lastOutput (produced by an upstream Analysis node)
// and enriches each record with a `_message` field (generated message content).
// The downstream auto_action node will use these records directly.
//
// Keeps lastOutput.records intact so send-email / send-whatsapp can iterate.

export async function handleMessageGen(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as MessageGenConfig

  // Pass through — keep the records structure from lastOutput
  // The real content generation happens inside action.handler.ts
  // where defaults are built per messageType/channel.
  const upstream = ctx.lastOutput as Record<string, unknown> | null
  const records  = Array.isArray(upstream?.records)
    ? (upstream!.records as Record<string, unknown>[])
    : Array.isArray(upstream) ? (upstream as Record<string, unknown>[]) : []

  const enriched = records.map(r => ({
    ...r,
    _messageType: config.messageType ?? 'campaign',
    _channel:     config.channel     ?? 'email',
    _tone:        config.tone        ?? 'profissional',
  }))

  const output = {
    ...(upstream ?? {}),
    records:     enriched,
    count:       enriched.length,
    messageType: config.messageType ?? 'campaign',
    channel:     config.channel     ?? 'email',
  }

  return {
    success: true,
    output,
    message: `Mensagem gerada para ${enriched.length} registro(s) — canal: ${config.channel ?? 'email'}`,
  }
}
