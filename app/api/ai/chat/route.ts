import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

type InvoiceSummary  = { amount: number | string; status: string; customer_id: string }
type CustomerSummary = { id: string; name: string }
type PaymentSummary  = { amount: number | string; paid_at: string }

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    const company_id = body ? getString(body, 'company_id') : undefined
    const message    = body ? getString(body, 'message')    : undefined

    console.log('[ai/chat] INPUT body:', JSON.stringify(body))
    console.log('[ai/chat] company_id:', company_id, '| message:', message)

    if (!company_id) {
      console.error('[ai/chat] MISSING company_id — body was:', body)
      return NextResponse.json(
        { error: true, message: 'company_id ausente. Certifique-se de estar logado e ter completado o diagnóstico.' },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { error: true, message: 'message ausente' },
        { status: 400 }
      )
    }

    // ── Supabase queries ────────────────────────────────────────────────────
    const db = getSupabaseServerClient()

    const [invoicesRes, customersRes, paymentsRes] = await Promise.all([
      db.from('invoices').select('amount, status, customer_id').eq('company_id', company_id).limit(100).returns<InvoiceSummary[]>(),
      db.from('customers').select('id, name').eq('company_id', company_id).limit(50).returns<CustomerSummary[]>(),
      db.from('payments').select('amount, paid_at').eq('company_id', company_id).limit(10).returns<PaymentSummary[]>(),
    ])

    if (invoicesRes.error) console.error('[ai/chat] invoices query error:', invoicesRes.error)
    if (customersRes.error) console.error('[ai/chat] customers query error:', customersRes.error)
    if (paymentsRes.error) console.error('[ai/chat] payments query error:', paymentsRes.error)

    const inv   = invoicesRes.data  ?? []
    const custs = customersRes.data ?? []
    const pays  = paymentsRes.data  ?? []

    console.log('[ai/chat] rows — invoices:', inv.length, '| customers:', custs.length, '| payments:', pays.length)

    // ── Build context ────────────────────────────────────────────────────────
    const custMap: Record<string, string> = {}
    for (const c of custs) custMap[c.id] = c.name

    const overdue      = inv.filter(i => i.status === 'overdue')
    const inadimplentes = [...new Set(overdue.map(i => custMap[i.customer_id] ?? 'Desconhecido'))]

    const context = {
      total_clientes:       custs.length,
      total_a_receber:      inv.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0),
      total_vencido:        overdue.reduce((s, i) => s + Number(i.amount), 0),
      total_pago:           inv.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
      faturas_pendentes:    inv.filter(i => i.status === 'pending').length,
      faturas_vencidas:     overdue.length,
      clientes_inadimplentes: inadimplentes,
      ultimos_pagamentos:   pays.slice(0, 5).map(p => ({ valor: p.amount, data: p.paid_at.slice(0, 10) })),
    }

    console.log('[ai/chat] context built:', JSON.stringify(context))

    // ── Anthropic call ───────────────────────────────────────────────────────
    const aiResponse = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Você é o assistente financeiro do NEXUS. Responda em português de forma direta e prática.
Dados da empresa:
${JSON.stringify(context, null, 2)}

Regras: use os dados reais, formate valores em R$, máximo 3 parágrafos.`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = aiResponse.content[0]?.type === 'text'
      ? aiResponse.content[0].text
      : null

    if (!reply) {
      console.error('[ai/chat] Anthropic returned empty content:', aiResponse.content)
      return NextResponse.json({
        reply: 'Não consegui gerar uma resposta agora. Tente novamente.',
        context,
      })
    }

    console.log('[ai/chat] ✅ reply generated, length:', reply.length)
    return NextResponse.json({ reply, context })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] UNHANDLED ERROR:', err)
    return NextResponse.json(
      { error: true, message, reply: 'Não consegui acessar seus dados agora, tente novamente.' },
      { status: 500 }
    )
  }
}
