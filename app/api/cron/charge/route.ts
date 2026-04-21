import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { sendWhatsApp, normalizePhone } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/email'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

type CustomerJoin = CustomerRow | CustomerRow[] | null

type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

type OverdueInvoice = {
  id: string
  amount: number | string
  due_date: string
  description: string | null
  payment_link: string | null
  company_id: string
  customers: CustomerJoin
}

type ChargeResult = {
  invoice_id: string
  customer: string
  channel: string
  status: string
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()
  const today = new Date().toISOString().split('T')[0]
  const results: ChargeResult[] = []

  const { data: markedOverdue } = await db
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', today)
    .select('id')
    .returns<Array<{ id: string }>>()

  console.log(`[Cron] Marcadas como overdue: ${markedOverdue?.length ?? 0}`)

  const { data: overdueInvoices } = await db
    .from('invoices')
    .select(`
      id, amount, due_date, description, payment_link,
      company_id,
      customers ( id, name, email, phone )
    `)
    .eq('status', 'overdue')
    .order('due_date', { ascending: true })
    .returns<OverdueInvoice[]>()

  if (!overdueInvoices?.length) {
    return NextResponse.json({ message: 'Nenhuma fatura vencida', marked_overdue: markedOverdue?.length ?? 0 })
  }

  const { data: sentToday } = await db
    .from('charge_logs')
    .select('invoice_id')
    .gte('sent_at', `${today}T00:00:00`)
    .returns<Array<{ invoice_id: string }>>()

  const sentIds = new Set((sentToday ?? []).map(log => log.invoice_id))

  for (const invoice of overdueInvoices) {
    if (sentIds.has(invoice.id)) continue

    const customer = getJoinedCustomer(invoice.customers)
    if (!customer) continue

    const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
    const valor = `R$ ${Number(invoice.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    const paymentLink = invoice.payment_link ?? `${process.env.NEXT_PUBLIC_APP_URL}/pagar/${invoice.id}`
    const message = await generateChargeMessage({ customerName: customer.name, valor, daysOverdue, paymentLink })

    let channel = 'none'
    let status = 'failed'
    let response = ''

    if (customer.phone) {
      const result = await sendWhatsApp({ phone: normalizePhone(customer.phone), message })
      channel = 'whatsapp'
      status = result.success ? (result.simulated ? 'simulated' : 'sent') : 'failed'
      response = result.error ?? result.messageId ?? ''
    }

    if ((status === 'failed' || channel === 'none') && customer.email) {
      const html = buildChargeEmailHTML({ customerName: customer.name, valor, daysOverdue, paymentLink, message })
      const result = await sendEmail({
        to: customer.email,
        subject: `Cobranca pendente - ${valor}`,
        html,
      })
      channel = 'email'
      status = result.success ? (result.simulated ? 'simulated' : 'sent') : 'failed'
      response = result.error ?? result.id ?? ''
    }

    await db.from('charge_logs').insert({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      channel,
      status,
      message,
      response,
    })

    results.push({ invoice_id: invoice.id, customer: customer.name, channel, status })
  }

  return NextResponse.json({
    marked_overdue: markedOverdue?.length ?? 0,
    charges_sent: results.filter(result => result.status !== 'failed').length,
    charges_failed: results.filter(result => result.status === 'failed').length,
    results,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}

function getJoinedCustomer(customer: CustomerJoin): CustomerRow | null {
  return Array.isArray(customer) ? customer[0] ?? null : customer
}

async function generateChargeMessage(params: {
  customerName: string
  valor: string
  daysOverdue: number
  paymentLink: string
}): Promise<string> {
  try {
    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Gere uma mensagem de cobranca profissional e empatica para WhatsApp.
Cliente: ${params.customerName}
Valor: ${params.valor}
Dias de atraso: ${params.daysOverdue}
Link de pagamento: ${params.paymentLink}

Regras:
- Maximo 280 caracteres
- Tom profissional mas amigavel
- Incluir o nome do cliente, valor e link
- Nao usar emojis excessivos
- Nao usar ameacas`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || defaultChargeMessage(params)
  } catch {
    return defaultChargeMessage(params)
  }
}

function defaultChargeMessage(p: { customerName: string; valor: string; daysOverdue: number; paymentLink: string }) {
  return `Ola ${p.customerName}, temos uma pendencia de ${p.valor} com ${p.daysOverdue} dia(s) de atraso. Regularize pelo link: ${p.paymentLink}`
}

function buildChargeEmailHTML(p: {
  customerName: string
  valor: string
  daysOverdue: number
  paymentLink: string
  message: string
}) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
      <h2 style="color:#ef4444">Cobranca Pendente - NEXUS</h2>
      <p>Ola <strong>${p.customerName}</strong>,</p>
      <p>${p.message}</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:24px 0">
        <p style="margin:0;font-size:14px;color:#6b7280">Valor em aberto</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#111827">${p.valor}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#ef4444">${p.daysOverdue} dia(s) em atraso</p>
      </div>
      <a href="${p.paymentLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
        Pagar Agora
      </a>
    </div>
  `
}
