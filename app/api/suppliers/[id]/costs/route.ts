// GET  /api/suppliers/[id]/costs  — cost history
// POST /api/suppliers/[id]/costs  — add a cost entry

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

  // Verify supplier belongs to company
  const { data: sup } = await db
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (!sup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('supplier_costs')
    .select('*')
    .eq('supplier_id', id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  req: NextRequest,
  context: Context,
) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Verify ownership
  const { data: sup } = await db
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (!sup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { amount, frequency, date } = body

  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('supplier_costs')
    .insert({
      supplier_id: id,
      amount:      Number(amount),
      frequency:   frequency ?? 'monthly',
      date:        date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
