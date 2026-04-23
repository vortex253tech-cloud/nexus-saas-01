// POST /api/autopilot/enable — toggle autopilot_enabled for the authenticated company
// Body: { enabled: boolean }

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as { enabled?: boolean }
  const enabled = body.enabled === true

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('companies')
    .update({ autopilot_enabled: enabled })
    .eq('id', ctx.company.id)

  if (error) return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })

  return NextResponse.json({ autopilot_enabled: enabled })
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data } = await db
    .from('companies')
    .select('autopilot_enabled')
    .eq('id', ctx.company.id)
    .single()

  return NextResponse.json({ autopilot_enabled: (data as { autopilot_enabled?: boolean } | null)?.autopilot_enabled ?? false })
}
