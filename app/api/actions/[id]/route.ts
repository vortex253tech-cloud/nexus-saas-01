// PATCH /api/actions/[id]
// Updates action status and ganho_realizado when done.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

const actionStatuses = ['pending', 'in_progress', 'done'] as const
type ActionStatus = typeof actionStatuses[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await readJsonObject(req)
  const rawStatus = body ? getString(body, 'status') : undefined
  const status = parseActionStatus(rawStatus)

  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Fetch current action to compute ganho_realizado
  const { data: existing, error: fetchErr } = await db
    .from('actions')
    .select('impacto_estimado, status')
    .eq('id', id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const ganho_realizado =
    status === 'done' ? (existing?.impacto_estimado ?? 0) : 0

  const { data, error } = await db
    .from('actions')
    .update({ status, ganho_realizado })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

function parseActionStatus(value: string | undefined): ActionStatus | null {
  return actionStatuses.find(status => status === value) ?? null
}
