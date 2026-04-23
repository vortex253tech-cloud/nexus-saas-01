// GET  /api/clients?company_id=...  — list clients with computed totals
// POST /api/clients                 — create client

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, getNumber, readJsonObject } from '@/lib/unknown'
import { computeEffectiveStatus } from '@/lib/collections'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Fetch clients ordered by total_revenue desc
  const { data, error } = await db
    .from('clients')
    .select('*')
    .eq('company_id', company_id)
    .order('total_revenue', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = data ?? []
  const totalRevenue = clients.reduce((s, c) => s + (c.total_revenue as number ?? 0), 0)

  // ─── 80/20 Pareto analysis ──────────────────────────────────────
  const top20Count = Math.ceil(clients.length * 0.2) || 1
  const top20Revenue = clients
    .slice(0, top20Count)
    .reduce((s, c) => s + (c.total_revenue as number ?? 0), 0)
  const top20Pct = totalRevenue > 0
    ? Math.round((top20Revenue / totalRevenue) * 100)
    : 0

  const clientsWithRank = clients.map((c, i) => ({
    ...c,
    rank: i + 1,
    revenue_pct: totalRevenue > 0
      ? Math.round(((c.total_revenue as number) / totalRevenue) * 100 * 10) / 10
      : 0,
    is_top20: i < top20Count,
    effective_status: computeEffectiveStatus(
      (c.status as string) ?? 'pending',
      (c.due_date as string | null) ?? null,
    ),
  }))

  return NextResponse.json({
    data: clientsWithRank,
    meta: {
      total: clients.length,
      totalRevenue,
      top20Count,
      top20Revenue,
      top20Pct,
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  const company_id   = body ? getString(body, 'company_id') : undefined
  const name         = body ? getString(body, 'name') : undefined
  const email        = body ? getString(body, 'email') : undefined
  const phone        = body ? getString(body, 'phone') : undefined
  const total_revenue = body ? getNumber(body, 'total_revenue') : undefined
  const origem       = body ? getString(body, 'origem') : undefined
  const notes        = body ? getString(body, 'notes') : undefined

  const due_date = body ? getString(body, 'due_date') : undefined

  if (!company_id || !name) {
    return NextResponse.json({ error: 'company_id and name required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('clients')
    .insert({
      company_id,
      name,
      email:         email ?? null,
      phone:         phone ?? null,
      total_revenue: total_revenue ?? 0,
      origem:        origem ?? null,
      notes:         notes ?? null,
      due_date:      due_date ?? null,
      status:        'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
