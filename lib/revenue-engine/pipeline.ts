// Revenue Engine — main pipeline
//
// Flow per client:
//   segment → decide action → generate payment link (overdue) →
//   send message (WhatsApp → email fallback) → log → continue
//
// Import data → AI detects → Decision made → Action triggered →
// Payment link sent → Payment confirmed (webhook) → Dashboard updated

import { getSupabaseServerClient }                        from '@/lib/supabase'
import { fetchAndSegmentClients, type SegmentedClient }   from './segmentation'
import { buildMessage, makeVars, emailSubject }           from './message-builder'
import { generatePaymentLink }                            from '@/lib/payments/stripe'
import { sendWhatsApp }                                   from '@/lib/whatsapp'
import { sendEmail, buildCollectionEmailHTML }            from '@/lib/email'

export interface PipelineResult {
  processed:             number
  overdue:               number
  inactive:              number
  active:                number
  actionsTriggered:      number
  paymentLinksGenerated: number
  messagesSent:          number
  errors:                string[]
}

type DB = ReturnType<typeof getSupabaseServerClient>

// ─── Step 1: Create invoice, generate Stripe link ─────────────────────────────

async function generateClientPaymentLink(
  db: DB,
  client: SegmentedClient,
  companyId: string,
  companyName: string,
): Promise<{ invoiceId: string; url: string } | null> {
  if (client.total_revenue <= 0) return null

  // Insert invoice first — its ID becomes the Stripe session reference
  const dueIso = (client.due_date ?? new Date(Date.now() + 7 * 86_400_000).toISOString()).split('T')[0]

  const { data: inv, error: invErr } = await db.from('invoices').insert({
    company_id:  companyId,
    client_id:   client.id,
    amount:      client.total_revenue,
    description: `Cobrança automatizada — ${client.name}`,
    status:      'pending',
    due_date:    dueIso,
  }).select('id').single()

  if (invErr || !inv) return null
  const invoiceId = inv.id as string

  // Generate Stripe checkout session (or manual-pay URL as fallback)
  const linkRes = await generatePaymentLink({
    invoiceId,
    companyId,
    amount:        client.total_revenue,
    description:   `Cobrança ${companyName} — ${client.name}`,
    customerEmail: client.email ?? undefined,
  })

  // Update invoice with URL + stripe session id
  await db.from('invoices').update({
    payment_link:      linkRes.url,
    stripe_session_id: linkRes.externalId,
  }).eq('id', invoiceId)

  // Attach latest invoice to client record
  await db.from('clients').update({
    last_invoice_id: invoiceId,
    updated_at:      new Date().toISOString(),
  }).eq('id', client.id)

  return { invoiceId, url: linkRes.url }
}

// ─── Step 2: Send message (WhatsApp → email fallback) ─────────────────────────

async function dispatchMessage(
  client: SegmentedClient,
  message: string,
  companyName: string,
): Promise<{ sent: boolean; method: string }> {
  // Try WhatsApp first
  if (client.phone) {
    try {
      const r = await sendWhatsApp({ phone: client.phone, message })
      if (r.success) return { sent: true, method: 'whatsapp' }
    } catch { /* fall through */ }
  }

  // Email fallback
  if (client.email) {
    try {
      const valor = client.total_revenue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      const html =
        client.action === 'collect_payment'
          ? buildCollectionEmailHTML({
              clientName:  client.name,
              valor:       `R$ ${valor}`,
              dueDate:     client.due_date,
              nomeEmpresa: companyName,
              daysOverdue: client.days_overdue,
            })
          : `<p>${message}</p>`    // reactivate / upsell use plain message

      const r = await sendEmail({
        to:      client.email,
        subject: emailSubject(client.action, client.name),
        html,
      })

      if (r.success) return { sent: true, method: 'email' }
    } catch { /* fall through */ }
  }

  return { sent: false, method: 'none' }
}

// ─── Step 3: Log action ────────────────────────────────────────────────────────

async function logAction(
  db: DB,
  opts: {
    companyId:   string
    clientId:    string
    segment:     string
    actionType:  string
    paymentLink: string | null
    invoiceId:   string | null
    sent:        boolean
    amountDue:   number
    method:      string
    message:     string
  },
) {
  try {
    await db.from('collection_logs').insert({
      company_id:   opts.companyId,
      client_id:    opts.clientId,
      segment:      opts.segment,
      action_type:  opts.actionType,
      payment_link: opts.paymentLink,
      invoice_id:   opts.invoiceId,
      message:      opts.message.slice(0, 500),
      status:       opts.sent ? 'sent' : 'failed',
      amount_due:   opts.amountDue,
      method:       opts.method,
      sent_at:      new Date().toISOString(),
    })
  } catch {
    // Logging failure must not abort the pipeline
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runRevenuePipeline(companyId: string): Promise<PipelineResult> {
  const db = getSupabaseServerClient()

  const result: PipelineResult = {
    processed: 0, overdue: 0, inactive: 0, active: 0,
    actionsTriggered: 0, paymentLinksGenerated: 0, messagesSent: 0, errors: [],
  }

  // Fetch company name for personalised messages
  const { data: company } = await db
    .from('companies')
    .select('name, brand_name')
    .eq('id', companyId)
    .single()

  const companyName = (company as { name?: string; brand_name?: string } | null)
    ?.brand_name
    ?? (company as { name?: string; brand_name?: string } | null)?.name
    ?? 'NEXUS'

  // Fetch and segment all non-paid clients
  const clients = await fetchAndSegmentClients(db, companyId)
  result.processed = clients.length

  for (const client of clients) {
    // Tally by segment
    result[client.segment]++

    let paymentLink: string | null = null
    let invoiceId:   string | null = null

    try {
      // Overdue: generate payment link
      if (client.action === 'collect_payment') {
        const linkData = await generateClientPaymentLink(db, client, companyId, companyName)
        if (linkData) {
          paymentLink = linkData.url
          invoiceId   = linkData.invoiceId
          result.paymentLinksGenerated++
        }
      }

      // Build dynamic message with {{name}}, {{value}}, {{link}}
      const vars    = makeVars(client, paymentLink ?? undefined)
      const message = buildMessage(client.action, vars)

      // Send (WhatsApp preferred, email fallback)
      const { sent, method } = await dispatchMessage(client, message, companyName)
      if (sent) result.messagesSent++
      result.actionsTriggered++

      // Log every action regardless of send outcome
      await logAction(db, {
        companyId,
        clientId:    client.id,
        segment:     client.segment,
        actionType:  client.action,
        paymentLink,
        invoiceId,
        sent,
        amountDue:   client.total_revenue,
        method,
        message,
      })

    } catch (err) {
      result.errors.push(`[${client.name}] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
