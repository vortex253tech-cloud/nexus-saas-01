import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ai = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { company_id } = await req.json()
    if (!company_id) return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })

    const db = getSupabaseServerClient()

    const [{ data: invoices }, { data: payments }, { data: customers }] = await Promise.all([
      db.from('invoices').select('id, amount, status, due_date, customer_id, customers(name)').eq('company_id', company_id),
      db.from('payments').select('id, amount, paid_at, invoice_id').eq('company_id', company_id),
      db.from('customers').select('id, name, email, phone').eq('company_id', company_id),
    ])

    const inv = invoices ?? []
    const pay = payments ?? []

    const total_pending  = inv.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
    const total_overdue  = inv.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0)
    const total_paid     = inv.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
    const total_invoiced = total_pending + total_overdue + total_paid
    const default_rate   = total_invoiced > 0 ? ((total_overdue / total_invoiced) * 100).toFixed(1) : '0'

    // Top devedores
    const debtByCustomer: Record<string, { name: string; total: number; count: number }> = {}
    for (const i of inv.filter(i => i.status === 'overdue')) {
      const c = i.customers as { name: string } | null
      const name = c?.name ?? 'Desconhecido'
      if (!debtByCustomer[i.customer_id]) debtByCustomer[i.customer_id] = { name, total: 0, count: 0 }
      debtByCustomer[i.customer_id].total += Number(i.amount)
      debtByCustomer[i.customer_id].count++
    }
    const top_debtors = Object.entries(debtByCustomer)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id, d]) => ({ customer_id: id, name: d.name, total_overdue: d.total, invoice_count: d.count }))

    // Receita mensal (últimos 6 meses)
    const monthlyRevenue: Record<string, number> = {}
    for (const p of pay) {
      const month = p.paid_at.slice(0, 7)
      monthlyRevenue[month] = (monthlyRevenue[month] ?? 0) + Number(p.amount)
    }

    const metrics = { total_pending, total_overdue, total_paid, total_invoiced, default_rate: `${default_rate}%`, customer_count: customers?.length ?? 0 }

    // Análise da IA
    const aiAnalysis = await generateInsights({ metrics, top_debtors, monthlyRevenue })

    return NextResponse.json({ metrics, top_debtors, monthly_revenue: monthlyRevenue, ai_analysis: aiAnalysis })
  } catch (err) {
    console.error('[financial-insights]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
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
        content: `Você é um CFO analisando dados financeiros. Analise e retorne JSON.

Dados:
${JSON.stringify(data, null, 2)}

Retorne SOMENTE JSON válido neste formato:
{
  "risk_level": "baixo|médio|alto|crítico",
  "risk_reason": "explicação em 1 frase",
  "summary": "resumo executivo em 2 frases",
  "top_actions": ["ação 1", "ação 2", "ação 3"],
  "alert": "alerta principal se houver, ou null"
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, top_actions: [], risk_level: 'médio' }
  } catch {
    return { summary: 'Análise indisponível', top_actions: [], risk_level: 'médio' }
  }
}
