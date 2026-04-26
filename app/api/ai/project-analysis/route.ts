// POST /api/ai/project-analysis

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

interface Product  { name: string; price: number; cost: number; margin: number; status: string }
interface Revenue  { name: string; value: number; source: string; date: string }
interface Expense  { name: string; value: number; category: string; date: string }

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { projectId } = await req.json() as { projectId?: string }
  if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Load project data
  const [projRes, prodRes, revRes, expRes] = await Promise.all([
    db.from('projects').select('id, name, type, description, goal')
      .eq('id', projectId).eq('company_id', ctx.company.id).single(),
    db.from('project_products').select('name, price, cost, margin, status')
      .eq('project_id', projectId).eq('company_id', ctx.company.id),
    db.from('project_revenues').select('name, value, source, date')
      .eq('project_id', projectId).eq('company_id', ctx.company.id),
    db.from('project_expenses').select('name, value, category, date')
      .eq('project_id', projectId).eq('company_id', ctx.company.id),
  ])

  if (!projRes.data) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  const project  = projRes.data
  const products = (prodRes.data ?? []) as Product[]
  const revenues = (revRes.data  ?? []) as Revenue[]
  const expenses = (expRes.data  ?? []) as Expense[]

  // Calculate metrics
  const totalRevenue  = revenues.reduce((s, r) => s + r.value, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.value, 0)
  const profit        = totalRevenue - totalExpenses
  const avgMargin     = products.length
    ? products.reduce((s, p) => s + p.margin, 0) / products.length : 0
  const bestProduct   = products.sort((a, b) =>
    (b.price - b.cost) - (a.price - a.cost))[0] ?? null
  const topExpense    = expenses.sort((a, b) => b.value - a.value)[0] ?? null

  const metrics = {
    totalRevenue,
    totalExpenses,
    profit,
    profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0',
    avgProductMargin: avgMargin.toFixed(1),
    bestProduct: bestProduct?.name ?? 'N/A',
    topExpenseCategory: topExpense?.category ?? 'N/A',
    productCount: products.length,
    revenueCount: revenues.length,
    expenseCount: expenses.length,
  }

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const dataStr = JSON.stringify({
    projeto: {
      nome: project.name,
      tipo: project.type,
      objetivo: project.goal,
    },
    metricas: {
      receita_total: fmtBRL(totalRevenue),
      custos_totais: fmtBRL(totalExpenses),
      lucro: fmtBRL(profit),
      margem_lucro: `${metrics.profitMargin}%`,
      margem_media_produtos: `${metrics.avgProductMargin}%`,
    },
    produtos: products.map(p => ({
      nome: p.name,
      preco: fmtBRL(p.price),
      custo: fmtBRL(p.cost),
      margem: `${p.margin}%`,
      status: p.status,
    })),
    receitas: revenues.map(r => ({ nome: r.name, valor: fmtBRL(r.value), fonte: r.source })),
    despesas: expenses.map(e => ({ nome: e.name, valor: fmtBRL(e.value), categoria: e.category })),
  }, null, 2)

  // Stub when no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = {
      insights: [
        `Receita total de ${fmtBRL(totalRevenue)} com lucro de ${fmtBRL(profit)}.`,
        products.length > 0 ? `${products.length} produto(s) cadastrado(s). Margem média: ${metrics.avgProductMargin}%.` : 'Nenhum produto cadastrado ainda.',
      ],
      alerts: profit < 0 ? ['⚠️ Projeto operando no prejuízo. Revise custos urgentemente.'] : [],
      opportunities: ['Automatize cobranças para aumentar recebimentos.'],
      simulated: true,
    }
    await saveAnalysis(db, projectId, ctx.company.id, stub)
    return NextResponse.json(stub)
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role:    'user',
        content: `Você é um consultor de negócios especialista.

Analise os dados do projeto abaixo e gere:

1. Insights claros e diretos
2. Alertas de risco financeiro
3. Oportunidades de crescimento

Foque em:
- aumento de lucro
- redução de custos
- priorização de produtos

Seja objetivo, estratégico e orientado a dinheiro.

Responda APENAS em JSON válido (sem markdown):
{
  "insights": ["string", "string"],
  "alerts": ["string"],
  "opportunities": ["string", "string"]
}

Dados:
${dataStr}`,
      }],
    })

    const text  = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean) as {
      insights: string[]; alerts: string[]; opportunities: string[]
    }

    await saveAnalysis(db, projectId, ctx.company.id, parsed)
    return NextResponse.json({ ...parsed, metrics })
  } catch (err) {
    console.error('[project-analysis]', err)
    return NextResponse.json({ error: 'Erro ao gerar análise com IA' }, { status: 500 })
  }
}

async function saveAnalysis(
  db: ReturnType<typeof import('@/lib/supabase').getSupabaseServerClient>,
  projectId: string,
  companyId: string,
  data: { insights: string[]; alerts: string[]; opportunities: string[] },
) {
  await db.from('project_analyses').insert({
    project_id:    projectId,
    company_id:    companyId,
    insights:      data.insights,
    alerts:        data.alerts,
    opportunities: data.opportunities,
  })
}
