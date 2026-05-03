// GET  /api/suppliers          — list all suppliers with costs
// POST /api/suppliers          — create supplier

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('suppliers')
    .select(`
      *,
      costs:supplier_costs(*)
    `)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, category, contact_email, contact_whatsapp, type, initialCost, frequency } = body

  if (!name || !category) {
    return NextResponse.json({ error: 'name and category required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  // Create supplier
  const { data: supplier, error: supErr } = await db
    .from('suppliers')
    .insert({
      company_id:       auth.companyId,
      name,
      category,
      contact_email:    contact_email    ?? null,
      contact_whatsapp: contact_whatsapp ?? null,
      type:             type             ?? 'recurring',
    })
    .select()
    .single()

  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 })

  // Optionally attach initial cost
  if (initialCost && Number(initialCost) > 0) {
    await db.from('supplier_costs').insert({
      supplier_id: supplier.id,
      amount:      Number(initialCost),
      frequency:   frequency ?? 'monthly',
      date:        new Date().toISOString().slice(0, 10),
    })
  }

  return NextResponse.json({ data: supplier }, { status: 201 })
}
