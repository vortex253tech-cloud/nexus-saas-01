// PATCH  /api/leads/manage/[id] — update status, notes, phone, email
// DELETE /api/leads/manage/[id] — delete a lead

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'No body' }, { status: 400 })

  const company_id = getString(body, 'company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  // Build update payload from whatever is provided
  const patch: Record<string, unknown> = {}
  const status = getString(body, 'status')
  const notes  = getString(body, 'notes')
  const phone  = getString(body, 'phone')
  const email  = getString(body, 'email')
  const name   = getString(body, 'name')

  if (status !== undefined) {
    const valid = ['new', 'contacted', 'converted', 'lost']
    if (!valid.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
    }
    patch.status = status
    if (status === 'converted') patch.converted_at = new Date().toISOString()
  }
  if (notes !== undefined) patch.notes = notes || null
  if (phone !== undefined) patch.phone = phone || null
  if (email !== undefined) patch.email = email || null
  if (name  !== undefined) patch.name  = name.trim() || undefined

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('leads')
    .update(patch)
    .eq('id', id)
    .eq('company_id', company_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }  = await params
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('company_id', company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
