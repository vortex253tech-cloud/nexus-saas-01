import { getSupabaseServerClient } from '@/lib/supabase'
import { sendWhatsApp }           from '@/lib/email'
import {
  extractRecords, renderTemplate, emptyResult,
  type ActionContext, type ActionResult,
} from './action.types'

interface SendWhatsAppConfig {
  message?:        string   // template with {{nome}} placeholders
  phoneField?:     string   // field holding the phone number (default: 'phone')
  saveToMessages?: boolean  // persist to messages table (default: true)
}

const WA_CAP = 100

// ─── SEND_WHATSAPP action ─────────────────────────────────────────────────────
// Sends (or simulates) a WhatsApp message per record from lastOutput.
// Persists every attempt to the messages table for traceability.
// Real provider integration: replace sendWhatsApp() stub in lib/email.ts.

export async function execute(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const cfg: SendWhatsAppConfig = {
    message:        config.message        as string | undefined,
    phoneField:     config.phoneField     as string | undefined,
    saveToMessages: config.saveToMessages !== false,
  }

  const records    = extractRecords(context.lastOutput)
  const phoneField = cfg.phoneField ?? 'phone'
  const template   = cfg.message ?? 'Olá {{nome}}, temos uma atualização para você.'
  const cap        = Math.min(records.length, WA_CAP)

  if (cap === 0) return emptyResult('SEND_WHATSAPP')

  let succeeded = 0
  const errors: string[] = []
  const sentTo: string[] = []

  for (let i = 0; i < cap; i++) {
    const record = records[i]
    const phone  = record[phoneField] as string | undefined
    if (!phone) continue

    const body   = renderTemplate(template, record)
    const result = await sendWhatsApp({ to: phone, body })

    if (result.success) {
      succeeded++
      sentTo.push(phone)
      if (cfg.saveToMessages) {
        await saveMessage({
          companyId:   context.companyId,
          executionId: context.executionId,
          type:        'whatsapp',
          recipient:   phone,
          content:     body,
          status:      result.simulated ? 'simulated' : 'sent',
          metadata:    { messageId: result.id, template: cfg.message },
        })
      }
    } else {
      errors.push(`${phone}: ${result.error ?? 'unknown error'}`)
    }
  }

  return {
    success:   succeeded > 0 || cap === 0,
    message:   `SEND_WHATSAPP: ${succeeded}/${cap} messages sent${errors.length ? ` (${errors.length} failed)` : ''}`,
    processed: cap,
    succeeded,
    errors,
    payload:   { phoneField, recipients: sentTo },
  }
}

async function saveMessage(data: {
  companyId:   string
  executionId: string
  type:        'email' | 'whatsapp'
  recipient:   string
  content:     string
  status:      'sent' | 'simulated' | 'failed'
  metadata?:   Record<string, unknown>
}): Promise<void> {
  const db = getSupabaseServerClient()
  await db.from('messages').insert({
    company_id:   data.companyId,
    execution_id: data.executionId,
    type:         data.type,
    recipient:    data.recipient,
    content:      data.content,
    status:       data.status,
    metadata:     data.metadata ?? {},
  })
}
