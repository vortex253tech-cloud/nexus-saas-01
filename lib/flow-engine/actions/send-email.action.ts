import { getSupabaseServerClient } from '@/lib/supabase'
import { sendEmail }              from '@/lib/email'
import {
  extractRecords, renderTemplate, emptyResult,
  type ActionContext, type ActionResult,
} from './action.types'

interface SendEmailConfig {
  subject?:        string
  template?:       string   // HTML with {{nome}}, {{email}} placeholders
  recipientField?: string   // which field holds the email (default: 'email')
  saveToMessages?: boolean  // persist to messages table (default: true)
}

const EMAIL_CAP = 100  // safety cap per execution

// ─── SEND_EMAIL action ────────────────────────────────────────────────────────
// 1. Extracts recipient records from lastOutput
// 2. Renders the HTML template per record
// 3. Calls sendEmail() — real send if RESEND_API_KEY set, simulation otherwise
// 4. Persists to messages table for traceability

export async function execute(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const cfg: SendEmailConfig = {
    subject:        config.subject        as string | undefined,
    template:       config.template       as string | undefined,
    recipientField: config.recipientField as string | undefined,
    saveToMessages: config.saveToMessages !== false,
  }

  const records      = extractRecords(context.lastOutput)
  const emailField   = cfg.recipientField ?? 'email'
  const subject      = cfg.subject  ?? 'Mensagem do NEXUS'
  const template     = cfg.template ?? 'Olá {{nome}}, temos novidades para você.'
  const cap          = Math.min(records.length, EMAIL_CAP)

  if (cap === 0) return emptyResult('SEND_EMAIL')

  let succeeded = 0
  const errors: string[] = []
  const sentRecipients: string[] = []

  for (let i = 0; i < cap; i++) {
    const record = records[i]
    const email  = record[emailField] as string | undefined
    if (!email) continue

    const html   = renderTemplate(template, record)
    const result = await sendEmail({ to: email, subject, html })

    if (result.success) {
      succeeded++
      sentRecipients.push(email)
      if (cfg.saveToMessages) {
        await saveMessage({
          companyId:   context.companyId,
          executionId: context.executionId,
          type:        'email',
          recipient:   email,
          subject,
          content:     html,
          status:      result.simulated ? 'simulated' : 'sent',
          metadata:    { messageId: result.id, template: cfg.template },
        })
      }
    } else {
      errors.push(`${email}: ${result.error ?? 'unknown error'}`)
    }
  }

  return {
    success:   succeeded > 0 || cap === 0,
    message:   `SEND_EMAIL: ${succeeded}/${cap} emails sent${errors.length ? ` (${errors.length} failed)` : ''}`,
    processed: cap,
    succeeded,
    errors,
    payload:   { subject, recipientField: emailField, recipients: sentRecipients },
  }
}

// ─── Persist to messages table ────────────────────────────────────────────────

async function saveMessage(data: {
  companyId:   string
  executionId: string
  type:        'email' | 'whatsapp'
  recipient:   string
  subject?:    string
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
    subject:      data.subject,
    content:      data.content,
    status:       data.status,
    metadata:     data.metadata ?? {},
  })
}
