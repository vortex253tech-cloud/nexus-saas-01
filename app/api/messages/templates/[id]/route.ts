// PATCH  /api/messages/templates/[id] — update template
// DELETE /api/messages/templates/[id] — delete template

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Partial<{
    name:     string
    type:     'email' | 'whatsapp'
    category: 'financial' | 'sales' | 'relationship' | 'custom'
    subject:  string
    content:  string
  }>

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('message_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()
  const { error } = await db
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
