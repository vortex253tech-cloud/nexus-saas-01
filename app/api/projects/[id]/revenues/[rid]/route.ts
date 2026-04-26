// DELETE /api/projects/[id]/revenues/[rid]

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string; rid: string }> }

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id, rid } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('project_revenues')
    .delete()
    .eq('id', rid)
    .eq('project_id', id)
    .eq('company_id', ctx.company.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
