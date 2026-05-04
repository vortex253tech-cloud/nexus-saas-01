// GET    /api/suppliers/[id]  — get supplier with costs
// PATCH  /api/suppliers/[id]  — update supplier
// DELETE /api/suppliers/[id]  — delete supplier

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Context = { params: Promise<{ id: string }> }

export async function GET(
  _req: NextRequest,
  context: Context,
) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('suppliers')
    .select('*, costs:supplier_costs(*)')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: NextRequest,
  context: Context,
) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('suppliers')
    .update(body)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  context: Context,
) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
