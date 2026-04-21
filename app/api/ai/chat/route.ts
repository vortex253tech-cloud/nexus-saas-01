import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

type InvoiceSummary = { amount: number | string; status: string; customer_id: string }
type CustomerSummary = { id: string; name: string }
type PaymentSummary = { amount: number | string; paid_at: string }

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const company_id = body ? getString(body, 'company_id') : undefined
    const message = body ? getString(body, 'message') : undefined
    if (!company_id || !message) {
      return NextResponse.json({ error: 'company_id e message obrigatorios' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    const [invoicesRes, customersRes, paymentsRes] = await Promise.all([
      db.from('invoices').select('amount, status, customer_id').eq('company_id', company_id).limit(100).returns<InvoiceSummary[]>(),
      db.from('customers').select('id, name').eq('company_id', company_id).limit(50).returns<CustomerSummary[]>(),
      db.from('payments').select('amount, paid_at').eq('company_id', company_id).limit(10).returns<PaymentSummary[]>(),
    ])

    const inv = invoicesRes.data ?? []
    const custs = customersRes.data ?? []
    const pays = paymentsRes.data ?? []

    const custMap: Record<string, string> = {}
    for (const customer of custs) custMap[customer.id] = customer.name

    const overdue = inv.filter(invoice => invoice.status === 'overdue')
    const inadimplentes = [...new Set(overdue.map(invoice => custMap[invoice.customer_id] ?? 'Desconhecido'))]

    const context = {
      total_clientes: custs.length,
      total_a_receber: inv.filter(invoice => invoice.status === 'pending').reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      total_vencido: overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      total_pago: inv.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      faturas_pendentes: inv.filter(invoice => invoice.status === 'pending').length,
      faturas_vencidas: overdue.length,
      clientes_inadimplentes: inadimplentes,
      ultimos_pagamentos: pays.slice(0, 5).map(payment => ({ valor: payment.amount, data: payment.paid_at.slice(0, 10) })),
    }

    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Voce e o assistente financeiro do NEXUS. Responda em portugues de forma direta e pratica.
Dados da empresa:
${JSON.stringify(context, null, 2)}

Regras: use os dados reais, formate valores em R$, maximo 3 paragrafos.`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Nao consegui processar.'

    return NextResponse.json({ reply, context })
  } catch (err) {
    console.error('[ai/chat]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
