// ─── Node Config Validator ────────────────────────────────────────────────────
// Validates node configurations before execution to catch misconfigured flows
// early, surfacing clear error messages instead of silent runtime failures.

import type { FlowNode, FlowNodeType } from '../types'

export interface ValidationError {
  nodeId:   string
  nodeType: string
  field:    string
  message:  string
}

export interface ValidationResult {
  valid:  boolean
  errors: ValidationError[]
}

// ─── Valid value sets ─────────────────────────────────────────────────────────

const VALID_DATA_SOURCES = new Set([
  'clients', 'invoices', 'overdue', 'financial', 'all_clients',
  'leads', 'new_leads', 'at_risk_clients',
])

const VALID_MESSAGE_TYPES = new Set([
  'email', 'whatsapp', 'sms', 'push',
])

const VALID_ACTION_TYPES = new Set([
  // SCREAMING_SNAKE (canonical)
  'SEND_EMAIL', 'SEND_WHATSAPP', 'UPDATE_CLIENT', 'UPDATE_FINANCIAL',
  'CREATE_LEAD', 'UPDATE_LEAD_STATUS', 'CREATE_PAYMENT_LINK',
  // snake_case legacy aliases
  'send_email', 'send_whatsapp', 'update_client', 'update_financial',
  'create_lead', 'update_lead_status', 'create_payment_link',
  'update_record', 'webhook', 'create_log',
])

const VALID_TRIGGER_TYPES = new Set([
  'manual', 'scheduled', 'client_at_risk', 'new_lead', 'overdue_invoice',
  'payment_received', 'flow_start',
])

// ─── Per-node-type validators ─────────────────────────────────────────────────

function validateTrigger(node: FlowNode): ValidationError[] {
  const errors: ValidationError[] = []
  const cfg = node.config as Record<string, unknown>
  const triggerType = cfg.triggerType as string | undefined

  if (triggerType && !VALID_TRIGGER_TYPES.has(triggerType)) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'triggerType',
      message:  `Invalid triggerType "${triggerType}". Valid: ${[...VALID_TRIGGER_TYPES].join(', ')}`,
    })
  }

  return errors
}

function validateAnalysis(node: FlowNode): ValidationError[] {
  const errors: ValidationError[] = []
  const cfg = node.config as Record<string, unknown>
  const dataSource = cfg.dataSource as string | undefined

  if (dataSource && !VALID_DATA_SOURCES.has(dataSource)) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'dataSource',
      message:  `Invalid dataSource "${dataSource}". Valid: ${[...VALID_DATA_SOURCES].join(', ')}`,
    })
  }

  const limit = cfg.limit
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 1000)) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'limit',
      message:  'limit must be a number between 1 and 1000',
    })
  }

  return errors
}

function validateMessageGen(node: FlowNode): ValidationError[] {
  const errors: ValidationError[] = []
  const cfg = node.config as Record<string, unknown>
  const messageType = cfg.messageType as string | undefined

  if (messageType && !VALID_MESSAGE_TYPES.has(messageType)) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'messageType',
      message:  `Invalid messageType "${messageType}". Valid: ${[...VALID_MESSAGE_TYPES].join(', ')}`,
    })
  }

  return errors
}

function validateAction(node: FlowNode): ValidationError[] {
  const errors: ValidationError[] = []
  const cfg = node.config as Record<string, unknown>
  const actionType = cfg.actionType as string | undefined

  if (!actionType) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'actionType',
      message:  'actionType is required for ACTION nodes',
    })
    return errors
  }

  if (!VALID_ACTION_TYPES.has(actionType)) {
    errors.push({
      nodeId:   node.id,
      nodeType: node.type,
      field:    'actionType',
      message:  `Unknown actionType "${actionType}". Valid: ${[...VALID_ACTION_TYPES].join(', ')}`,
    })
  }

  return errors
}

// ─── Normalise type string → base category ────────────────────────────────────

function baseType(rawType: string): string {
  return rawType.toUpperCase()
    .replace(/^NODE_/, '')
    .replace(/-/g, '_')
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateNodeConfig(node: FlowNode): ValidationError[] {
  const t = baseType(node.type)

  if (t === 'TRIGGER')     return validateTrigger(node)
  if (t === 'ANALYSIS')    return validateAnalysis(node)
  if (t === 'ACTION')      return validateAction(node)
  if (t.includes('MESSAGE') || t.includes('MSG')) return validateMessageGen(node)

  // DECISION, RESULT — no required config fields
  return []
}

export function validateFlow(nodes: FlowNode[]): ValidationResult {
  const errors: ValidationError[] = nodes.flatMap(validateNodeConfig)
  return { valid: errors.length === 0, errors }
}
