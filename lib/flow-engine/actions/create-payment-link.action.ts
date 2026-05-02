// CREATE_PAYMENT_LINK action
// Generates a payment link for an invoice and stores it.
//
// Config:
//   description? — invoice description template (supports {{name}})
//
// Input (from lastOutput):
//   Records with { id, amount, customer_id? } from an invoices analysis node
//   OR config.invoice_id + config.amount for a single invoice

import { getSupabaseServerClient } from '@/lib/supabase'
import { generatePaymentLink }     from '@/lib/payments/stripe'
import type { ActionFn, ActionResult } from './action.types'
import { extractRecords, renderTemplate } from './action.types'

export const execute: ActionFn = async (config, context) => {
  const db      = getSupabaseServerClient()
  const descTpl = (config.description as string | undefined) ?? 'Fatura {{id}}'

  // Support single invoice from config when no upstream records
  const upstream = extractRecords(context.lastOutput)

  type InvoiceTarget = {
    id:          string
    amount:      number
    description?: string
    customer_email?: string
  }

  let targets: InvoiceTarget[]

  if (upstream.length > 0) {
    targets = upstream
      .filter(r => r.id && r.amount)
      .map(r => ({
        id:             r.id as string,
        amount:         Number(r.amount),
        description:    renderTemplate(descTpl, r),
        customer_email: r.email as string | undefined,
      }))
  } else {
    const invoiceId = config.invoice_id as string | undefined
    const amount    = config.amount    as number | undefined
    if (!invoiceId || !amount) {
      return {
        success:   false,
        message:   'CREATE_PAYMENT_LINK: no invoice records and no config.invoice_id/amount',
        processed: 0, succeeded: 0,
        errors:    ['Provide upstream invoice records or config.invoice_id + config.amount'],
        payload:   {},
      }
    }
    targets = [{ id: invoiceId, amount, description: descTpl }]
  }

  const errors: string[] = []
  let succeeded = 0
  const links: string[] = []

  for (const t of targets) {
    try {
      const result = await generatePaymentLink({
        invoiceId:     t.id,
        companyId:     context.companyId,
        amount:        t.amount,
        description:   t.description ?? `Fatura ${t.id.slice(0, 8)}`,
        customerEmail: t.customer_email,
      })

      await db
        .from('invoices')
        .update({ payment_link: result.url })
        .eq('id', t.id)
        .eq('company_id', context.companyId)

      links.push(result.url)
      succeeded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${t.id}: ${msg}`)
    }
  }

  const result: ActionResult = {
    success:   succeeded > 0 || targets.length === 0,
    message:   `CREATE_PAYMENT_LINK: ${succeeded}/${targets.length} links generated`,
    processed: targets.length,
    succeeded,
    errors,
    payload:   { links },
  }

  return result
}
