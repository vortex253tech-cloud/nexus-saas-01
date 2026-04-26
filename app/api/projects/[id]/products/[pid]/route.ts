// PATCH  /api/projects/[id]/products/[pid] — update product
// DELETE /api/projects/[id]/products/[pid] — delete product

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string; pid: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, pid } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const db   = getSupabaseServerClient()

  const { data, error } = await db
    .from('project_products')
    .update(body)
    .eq('id', pid)
    .eq('project_id', id)
    .eq('company_id', ctx.company.id)
    .select('id, name, price, cost, margin, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id, pid } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('project_products')
    .delete()
    .eq('id', pid)
    .eq('project_id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
