// POST /api/automations/[id]/toggle — activate or deactivate automation

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()

  const { data: auto, error } = await db
    .from('automations')
    .select('status')
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (error || !auto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = auto.status === 'active' ? 'inactive' : 'active'

  await db
    .from('automations')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ status: newStatus })
}
