// POST /api/automations/[id]/execute — manually trigger a flow now (bypasses cron)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { executeFlow } from '@/lib/automations-engine'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  try {
    const result = await executeFlow(id, ctx.company.id)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao executar automação'
    console.error('[api/automations/execute]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
