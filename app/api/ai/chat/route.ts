import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { company_id, message } = await req.json()
    if (!company_id || !message) return NextResponse.json({ error: 'company_id e message obrigatórios' }, { status: 400 })

    const db = getSupabaseServerClient()

    const [{ data: invoices }, { data: customers }, { data: payments }] = await Promise.all([
      db.from('invoices').select('amount, status, due_date, customers(name)').eq('company_id', company_id).limit(100),
      db.from('customers').select('name, email, phone').eq('company_id', company_id).limit(50),
      db.from('payments').select('amount, paid_at').eq('company_id', company_id).limit(50),
    ])

    const inv = invoices ?? []
    const context = {
      total_clientes: customers?.length ?? 0,
      total_a_receber: inv.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0),
      total_vencido: inv.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
      total_pago: inv.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
      faturas_pendentes: inv.filter(i => i.status === 'pending').length,
      faturas_vencidas: inv.filter(i => i.status === 'overdue').length,
      clientes_inadimplentes: [...new Set(inv.filter(i => i.status === 'overdue').map(i => (i.customers as {name:string}|null)?.name))].filter(Boolean),
      ultimos_pagamentos: (payments ?? []).slice(0, 5).map(p => ({ valor: p.amount, data: p.paid_at?.slice(0, 10) })),
    }

    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Você é o assistente financeiro do NEXUS. Responda de forma direta e objetiva em português.
Dados financeiros da empresa:
${JSON.stringify(context, null, 2)}

Regras:
- Use os dados reais acima para responder
- Seja direto e prático
- Formate valores em R$ com separador de milhar
- Máximo 3 parágrafos`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Não consegui processar.'

    return NextResponse.json({ reply, context })
  } catch (err) {
    console.error('[ai/chat]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
