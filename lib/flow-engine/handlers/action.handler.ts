import { getSupabaseServerClient } from '@/lib/supabase'
import { sendEmail }               from '@/lib/email'
import type { FlowNode, ExecutionContext, NodeResult } from '../types'

type ActionType = 'send_email' | 'update_record' | 'create_log' | 'webhook'

interface ActionConfig {
  actionType:   ActionType
  // send_email
  subject?:     string
  template?:    string       // HTML with {{nome}}, {{email}} placeholders
  recipientField?: string    // which field on each record holds the email
  // update_record
  table?:       string
  field?:       string
  value?:       unknown
  // webhook
  url?:         string
  method?:      'GET' | 'POST' | 'PUT'
  payload?:     Record<string, unknown>
}

interface ActionOutput {
  actionType: ActionType
  processed:  number
  succeeded:  number
  errors:     string[]
}

// ─── Action handler ───────────────────────────────────────────────────────────
// Executes side-effects: emails, record updates, webhooks.
// Always logs what happened — never silently swallows results.

export async function handleAction(
  node: FlowNode,
  ctx:  ExecutionContext,
): Promise<NodeResult> {
  const config = node.config as unknown as ActionConfig

  switch (config.actionType) {
    case 'send_email':    return sendEmailAction(config, ctx)
    case 'update_record': return updateRecordAction(config, ctx)
    case 'webhook':       return webhookAction(config, ctx)
    default:              return createLogAction(config, ctx)
  }
}

// ─── send_email ───────────────────────────────────────────────────────────────

async function sendEmailAction(
  config: ActionConfig,
  ctx:    ExecutionContext,
): Promise<NodeResult> {
  const records   = extractRecords(ctx.lastOutput)
  const emailField = config.recipientField ?? 'email'
  const subject    = config.subject ?? 'Mensagem importante'
  const template   = config.template ?? 'Olá {{nome}}!'

  let succeeded = 0
  const errors: string[] = []
  const cap = Math.min(records.length, 100)  // safety cap

  for (let i = 0; i < cap; i++) {
    const record = records[i] as Record<string, unknown>
    const email  = record[emailField] as string | undefined
    if (!email) continue

    const html = renderTemplate(template, record)

    try {
      await sendEmail({ to: email, subject, html })
      succeeded++
    } catch (err) {
      errors.push(`${email}: ${String(err)}`)
    }
  }

  const output: ActionOutput = {
    actionType: 'send_email',
    processed:  cap,
    succeeded,
    errors,
  }

  return {
    success: succeeded > 0 || records.length === 0,
    output,
    message: `Sent ${succeeded}/${cap} emails${errors.length ? ` (${errors.length} errors)` : ''}`,
  }
}

// ─── update_record ────────────────────────────────────────────────────────────

async function updateRecordAction(
  config: ActionConfig,
  ctx:    ExecutionContext,
): Promise<NodeResult> {
  if (!config.table || !config.field) {
    return { success: false, output: null, message: 'Missing table or field in action config' }
  }

  const records = extractRecords(ctx.lastOutput)
  const db      = getSupabaseServerClient()
  let updated   = 0
  const errors: string[] = []

  for (const record of records) {
    const r = record as Record<string, unknown>
    if (!r.id) continue

    const { error } = await db
      .from(config.table)
      .update({ [config.field]: config.value })
      .eq('id', r.id as string)
      .eq('company_id', ctx.companyId)

    if (error) errors.push(`${String(r.id)}: ${error.message}`)
    else updated++
  }

  const output: ActionOutput = {
    actionType: 'update_record',
    processed:  records.length,
    succeeded:  updated,
    errors,
  }

  return {
    success: updated > 0 || records.length === 0,
    output,
    message: `Updated ${updated}/${records.length} records in "${config.table}"`,
  }
}

// ─── webhook ──────────────────────────────────────────────────────────────────

async function webhookAction(
  config: ActionConfig,
  ctx:    ExecutionContext,
): Promise<NodeResult> {
  if (!config.url) {
    return { success: false, output: null, message: 'Missing url in webhook action config' }
  }

  const payload = {
    ...config.payload,
    companyId:  ctx.companyId,
    executionId: ctx.executionId,
    data:       ctx.lastOutput,
  }

  try {
    const res = await fetch(config.url, {
      method:  config.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    return {
      success: res.ok,
      output:  { status: res.status, url: config.url },
      message: `Webhook ${config.method ?? 'POST'} ${config.url} → ${res.status}`,
    }
  } catch (err) {
    return { success: false, output: null, message: `Webhook failed: ${String(err)}` }
  }
}

// ─── create_log (default / pass-through) ─────────────────────────────────────

async function createLogAction(
  config: ActionConfig,
  ctx:    ExecutionContext,
): Promise<NodeResult> {
  return {
    success: true,
    output:  { logged: true, actionType: config.actionType, executionId: ctx.executionId },
    message: `Action "${config.actionType}" logged`,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractRecords(lastOutput: unknown): unknown[] {
  if (!lastOutput) return []
  const out = lastOutput as Record<string, unknown>
  if (Array.isArray(out.records)) return out.records
  if (Array.isArray(lastOutput))  return lastOutput
  return []
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return String(data[key] ?? data[key.toLowerCase()] ?? `{{${key}}}`)
  })
}
