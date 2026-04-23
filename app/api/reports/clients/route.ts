// GET /api/reports/clients?company_id=... — CSV download of 80/20 report
// Requires PRO plan (or active trial).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import { checkPlanAccess } from '@/lib/trial'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  // ─── Plan gate: export_csv requires PRO ──────────────────────
  const ctx = await getAuthContext()
  if (ctx) {
    const allowed = checkPlanAccess(ctx.subscription, ctx.user.plan, 'export_csv')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Disponível no plano Pro', code: 'PLAN_GATE' },
        { status: 403 }
      )
    }
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('clients')
    .select('name, email, phone, total_revenue, origem, created_at')
    .eq('company_id', company_id)
    .order('total_revenue', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = data ?? []
  const totalRevenue = clients.reduce((s, c) => s + ((c.total_revenue as number) ?? 0), 0)
  const top20Count = Math.ceil(clients.length * 0.2) || 1

  // ─── Build CSV ────────────────────────────────────────────────
  const header = 'Ranking,Nome,Email,Telefone,Faturamento (R$),% da Receita,Top 20%,Origem,Cadastrado em\n'
  const rows = clients.map((c, i) => {
    const revenue = (c.total_revenue as number) ?? 0
    const pct = totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : '0.0'
    const isTop = i < top20Count ? 'SIM' : 'NÃO'
    const date = new Date(c.created_at as string).toLocaleDateString('pt-BR')
    return [
      i + 1,
      `"${(c.name as string).replace(/"/g, '""')}"`,
      c.email ?? '',
      c.phone ?? '',
      revenue.toFixed(2),
      pct,
      isTop,
      c.origem ?? '',
      date,
    ].join(',')
  }).join('\n')

  const csv = header + rows

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-ranking-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
