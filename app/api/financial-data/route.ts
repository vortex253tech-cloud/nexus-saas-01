// GET /api/financial-data?company_id=...
// POST /api/financial-data  { company_id, revenue, costs, profit, period_label, period_date }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getNumber, getString, readJsonObject } from '@/lib/unknown'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('financial_data')
    .select()
    .eq('company_id', company_id)
    .order('period_date', { ascending: false })
    .limit(24)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  const company_id = body ? getString(body, 'company_id') : undefined
  const revenue = body ? getNumber(body, 'revenue') : undefined
  const costs = body ? getNumber(body, 'costs') : undefined
  const profit = body ? getNumber(body, 'profit') : undefined
  const period_label = body ? getString(body, 'period_label') : undefined
  const period_date = body ? getString(body, 'period_date') : undefined
  const note = body ? getString(body, 'note') : undefined

  if (!company_id || revenue == null || costs == null || profit == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('financial_data')
    .insert({ company_id, revenue, costs, profit, period_label, period_date, note: note ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ─── Fire-and-forget: auto-trigger insight generation ─────────
  const origin = req.nextUrl.origin
  void (async () => {
    try {
      const [companyRes, finRes] = await Promise.all([
        db.from('companies')
          .select('nome_empresa, setor, perfil, principal_desafio, meta_mensal')
          .eq('id', company_id)
          .single(),
        db.from('financial_data')
          .select()
          .eq('company_id', company_id)
          .order('period_date', { ascending: false })
          .limit(24),
      ])

      if (companyRes.error || !companyRes.data) return

      const c = companyRes.data as {
        nome_empresa?: string
        setor?: string
        perfil?: string
        principal_desafio?: string
        meta_mensal?: number
      }

      await fetch(`${origin}/api/insights/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id,
          perfil: c.perfil ?? 'outro',
          setor: c.setor ?? 'Negócios',
          metaMensal: c.meta_mensal ?? 50000,
          principalDesafio: c.principal_desafio ?? 'fluxo',
          nomeEmpresa: c.nome_empresa ?? 'Minha Empresa',
          financialData: finRes.data ?? [],
        }),
      })
      console.log('[financial-data] Auto-triggered insight generation for', company_id)
    } catch (err) {
      console.error('[financial-data] Auto-trigger failed:', err)
    }
  })()

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { error } = await db.from('financial_data').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
