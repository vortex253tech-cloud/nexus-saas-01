// PATCH /api/clients/[id]  — update client (name, revenue, etc.)
// DELETE /api/clients/[id] — delete client
// Both operations are scoped to the authenticated company_id.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, getNumber, readJsonObject } from '@/lib/unknown'
import { getAuthContext } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  const name          = getString(body, 'name')
  const email         = getString(body, 'email')
  const phone         = getString(body, 'phone')
  const total_revenue = getNumber(body, 'total_revenue')
  const origem        = getString(body, 'origem')
  const notes         = getString(body, 'notes')
  const due_date      = getString(body, 'due_date')
  const status        = getString(body, 'status')

  if (name !== undefined)          update.name = name
  if (email !== undefined)         update.email = email
  if (phone !== undefined)         update.phone = phone
  if (total_revenue !== undefined) update.total_revenue = total_revenue
  if (origem !== undefined)        update.origem = origem
  if (notes !== undefined)         update.notes = notes
  if (due_date !== undefined)      update.due_date = due_date || null
  if (status !== undefined && ['pending', 'paid', 'overdue'].includes(status)) {
    update.status = status
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('clients')
    .update(update)
    .eq('id', id)
    .eq('company_id', ctx.companyId)   // ← isolation: only own company's clients
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()

  // Confirm the record belongs to this company before deleting
  const { data: existing } = await db
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)   // ← isolation: double-guard

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
