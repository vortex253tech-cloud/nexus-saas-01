import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { company_id, message } = await req.json()
    if (!company_id || !message) {
      return NextResponse.json({ error: 'company_id e message obrigatórios' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    const [invoicesRes, customersRes, paymentsRes] = await Promise.all([
      db.from('invoices').select('amount, status, customer_id').eq('company_id', company_id).limit(100),
      db.from('customers').select('id, name').eq('company_id', company_id).limit(50),
      db.from('payments').select('amount, paid_at').eq('company_id', company_id).limit(10),
    ])

    const inv   = (invoicesRes.data  ?? []) as { amount: number; status: string; customer_id: string }[]
    const custs = (customersRes.data ?? []) as { id: string; name: string }[]
    const pays  = (paymentsRes.data  ?? []) as { amount: number; paid_at: string }[]

    const custMap: Record<string, string> = {}
    for (const c of custs) custMap[c.id] = c.name

    const overdue = inv.filter(i => i.status === 'overdue')
    const inadimplentes = [...new Set(overdue.map(i => custMap[i.customer_id] ?? 'Desconhecido'))]

    const context = {
      total_clientes:     custs.length,
      total_a_receber:    inv.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0),
      total_vencido:      overdue.reduce((s, i) => s + Number(i.amount), 0),
      total_pago:         inv.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
      faturas_pendentes:  inv.filter(i => i.status === 'pending').length,
      faturas_vencidas:   overdue.length,
      clientes_inadimplentes: inadimplentes,
      ultimos_pagamentos: pays.slice(0, 5).map(p => ({ valor: p.amount, data: p.paid_at.slice(0, 10) })),
    }

    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Você é o assistente financeiro do NEXUS. Responda em português de forma direta e prática.
Dados da empresa:
${JSON.stringify(context, null, 2)}

Regras: use os dados reais, formate valores em R$, máximo 3 parágrafos.`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Não consegui processar.'

    return NextResponse.json({ reply, context })
  } catch (err) {
    console.error('[ai/chat]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
