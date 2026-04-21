import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, isRecord, readJsonObject } from '@/lib/unknown'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

type InvoiceWithCustomer = {
  id: string
  amount: number | string
  status: string
  due_date: string
  customer_id: string
  customers: CustomerJoin
}

type PaymentRow = {
  id: string
  amount: number | string
  paid_at: string
  invoice_id: string
}

type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

type CustomerJoin = CustomerRow[] | null

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const company_id = body ? getString(body, 'company_id') : undefined
    if (!company_id) return NextResponse.json({ error: 'company_id obrigatorio' }, { status: 400 })

    const db = getSupabaseServerClient()

    const [{ data: invoices }, { data: payments }, { data: customers }] = await Promise.all([
      db.from('invoices').select('id, amount, status, due_date, customer_id, customers(name)').eq('company_id', company_id).returns<InvoiceWithCustomer[]>(),
      db.from('payments').select('id, amount, paid_at, invoice_id').eq('company_id', company_id).returns<PaymentRow[]>(),
      db.from('customers').select('id, name, email, phone').eq('company_id', company_id).returns<CustomerRow[]>(),
    ])

    const inv = invoices ?? []
    const pay = payments ?? []

    const total_pending = inv.filter(i => i.status === 'pending').reduce((sum, i) => sum + Number(i.amount), 0)
    const total_overdue = inv.filter(i => i.status === 'overdue').reduce((sum, i) => sum + Number(i.amount), 0)
    const total_paid = inv.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const total_invoiced = total_pending + total_overdue + total_paid
    const default_rate = total_invoiced > 0 ? ((total_overdue / total_invoiced) * 100).toFixed(1) : '0'

    const debtByCustomer: Record<string, { name: string; total: number; count: number }> = {}
    for (const invoice of inv.filter(i => i.status === 'overdue')) {
      const customer = getJoinedCustomer(invoice.customers)
      const name = customer?.name ?? 'Desconhecido'
      if (!debtByCustomer[invoice.customer_id]) debtByCustomer[invoice.customer_id] = { name, total: 0, count: 0 }
      debtByCustomer[invoice.customer_id].total += Number(invoice.amount)
      debtByCustomer[invoice.customer_id].count++
    }

    const top_debtors = Object.entries(debtByCustomer)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id, debt]) => ({ customer_id: id, name: debt.name, total_overdue: debt.total, invoice_count: debt.count }))

    const monthlyRevenue: Record<string, number> = {}
    for (const payment of pay) {
      const month = payment.paid_at.slice(0, 7)
      monthlyRevenue[month] = (monthlyRevenue[month] ?? 0) + Number(payment.amount)
    }

    const metrics = {
      total_pending,
      total_overdue,
      total_paid,
      total_invoiced,
      default_rate: `${default_rate}%`,
      customer_count: customers?.length ?? 0,
    }

    const aiAnalysis = await generateInsights({ metrics, top_debtors, monthlyRevenue })

    return NextResponse.json({ metrics, top_debtors, monthly_revenue: monthlyRevenue, ai_analysis: aiAnalysis })
  } catch (err) {
    console.error('[financial-insights]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function getJoinedCustomer(customer: CustomerJoin): Pick<CustomerRow, 'name'> | null {
  const value = Array.isArray(customer) ? customer[0] : null
  if (!isRecord(value)) return null

  const name = getString(value, 'name')
  return name ? { name } : null
}

async function generateInsights(data: {
  metrics: Record<string, unknown>
  top_debtors: Array<{ name: string; total_overdue: number }>
  monthlyRevenue: Record<string, number>
}) {
  try {
    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Voce e um CFO analisando dados financeiros. Analise e retorne JSON.

Dados:
${JSON.stringify(data, null, 2)}

Retorne SOMENTE JSON valido neste formato:
{
  "risk_level": "baixo|medio|alto|critico",
  "risk_reason": "explicacao em 1 frase",
  "summary": "resumo executivo em 2 frases",
  "top_actions": ["acao 1", "acao 2", "acao 3"],
  "alert": "alerta principal se houver, ou null"
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed: unknown = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    return parsed ?? { summary: text, top_actions: [], risk_level: 'medio' }
  } catch {
    return { summary: 'Analise indisponivel', top_actions: [], risk_level: 'medio' }
  }
}
