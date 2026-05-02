import { getSupabaseServerClient } from '@/lib/supabase'
import { sendEmail }               from '@/lib/email'
import type { ActionFn, ActionContext, ActionResult } from './actions/action.types'
import { extractRecords, renderTemplate }             from './actions/action.types'

import * as sendEmailAction      from './actions/send-email.action'
import * as sendWhatsAppAction   from './actions/send-whatsapp.action'
import * as updateClientAction   from './actions/update-client.action'
import * as updateFinancialAction from './actions/update-financial.action'
import * as createLeadAction          from './actions/create-lead.action'
import * as updateLeadAction          from './actions/update-lead.action'
import * as createPaymentLinkAction   from './actions/create-payment-link.action'

// ─── Action Registry ──────────────────────────────────────────────────────────
// Maps action type strings → handler functions.
// Both SCREAMING_SNAKE (new) and snake_case (legacy) are accepted.

const REGISTRY: Record<string, ActionFn> = {
  // ── New named types ────────────────────────────────────────────────────────
  SEND_EMAIL:         sendEmailAction.execute,
  SEND_WHATSAPP:      sendWhatsAppAction.execute,
  UPDATE_CLIENT:      updateClientAction.execute,
  UPDATE_FINANCIAL:   updateFinancialAction.execute,
  CREATE_LEAD:           createLeadAction.execute,
  UPDATE_LEAD_STATUS:    updateLeadAction.execute,
  CREATE_PAYMENT_LINK:   createPaymentLinkAction.execute,

  // ── Legacy aliases (backward compat with existing canvas flows) ───────────
  send_email:            sendEmailAction.execute,
  send_whatsapp:         sendWhatsAppAction.execute,
  update_client:         updateClientAction.execute,
  update_financial:      updateFinancialAction.execute,
  create_lead:           createLeadAction.execute,
  update_lead_status:    updateLeadAction.execute,
  create_payment_link:   createPaymentLinkAction.execute,
  update_record:    updateRecordLegacy,
  webhook:          webhookLegacy,
  create_log:       createLogLegacy,
}

// ─── ActionHandlerService ─────────────────────────────────────────────────────
// Single entry-point called by action.handler.ts.
// Returns a structured ActionResult for uniform logging.

export class ActionHandlerService {
  async executeAction(
    actionType: string,
    config:     Record<string, unknown>,
    context:    ActionContext,
  ): Promise<ActionResult> {
    const handler = REGISTRY[actionType]

    if (!handler) {
      return {
        success:   false,
        message:   `Unknown action type: "${actionType}"`,
        processed: 0,
        succeeded: 0,
        errors:    [`No handler registered for "${actionType}"`],
        payload:   { actionType },
      }
    }

    try {
      return await handler(config, context)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success:   false,
        message:   `${actionType} threw an error: ${msg}`,
        processed: 0,
        succeeded: 0,
        errors:    [msg],
        payload:   { actionType },
      }
    }
  }

  /** Returns every registered action type (useful for the canvas node picker). */
  static registeredTypes(): string[] {
    return [...new Set(Object.keys(REGISTRY))]
  }
}

// ─── Legacy handlers (kept inline — no messages table, backward compat) ───────

async function updateRecordLegacy(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const table   = config.table   as string | undefined
  const field   = config.field   as string | undefined
  const value   = config.value

  if (!table || !field) {
    return { success: false, message: 'update_record: missing table or field', processed: 0, succeeded: 0, errors: [], payload: {} }
  }

  const records = extractRecords(context.lastOutput)
  const db      = getSupabaseServerClient()
  let updated   = 0
  const errors: string[] = []

  for (const record of records) {
    if (!record.id) continue
    const { error } = await db
      .from(table)
      .update({ [field]: value })
      .eq('id', record.id as string)
      .eq('company_id', context.companyId)

    if (error) errors.push(`${String(record.id)}: ${error.message}`)
    else updated++
  }

  return {
    success:   updated > 0 || records.length === 0,
    message:   `update_record: ${updated}/${records.length} updated in "${table}"`,
    processed: records.length, succeeded: updated, errors,
    payload:   { table, field, value },
  }
}

async function webhookLegacy(
  config: Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const url    = config.url    as string | undefined
  const method = (config.method as string | undefined) ?? 'POST'

  if (!url) {
    return { success: false, message: 'webhook: missing url', processed: 0, succeeded: 0, errors: [], payload: {} }
  }

  const body = {
    ...(config.payload as Record<string, unknown> | undefined),
    companyId:   context.companyId,
    executionId: context.executionId,
    data:        context.lastOutput,
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    return {
      success:   res.ok,
      message:   `webhook: ${method} ${url} → ${res.status}`,
      processed: 1, succeeded: res.ok ? 1 : 0,
      errors:    res.ok ? [] : [`HTTP ${res.status}`],
      payload:   { url, method, status: res.status },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `webhook failed: ${msg}`, processed: 1, succeeded: 0, errors: [msg], payload: { url } }
  }
}

async function createLogLegacy(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  return {
    success:   true,
    message:   `create_log: action "${config.actionType as string}" logged`,
    processed: 0, succeeded: 0, errors: [],
    payload:   { actionType: config.actionType, executionId: context.executionId },
  }
}

// Suppress unused import warning — sendEmail is available for future inline use
void sendEmail
void renderTemplate
