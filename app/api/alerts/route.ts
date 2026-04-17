// GET /api/alerts?company_id=...
// PATCH /api/alerts/[id] to mark as read/dismissed

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('alerts')
    .select()
    .eq('company_id', company_id)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, lido, dismissed } = body as { id: string; lido?: boolean; dismissed?: boolean }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const update: Record<string, boolean> = {}
  if (lido !== undefined) update.lido = lido
  if (dismissed !== undefined) update.dismissed = dismissed

  const { data, error } = await db.from('alerts').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
