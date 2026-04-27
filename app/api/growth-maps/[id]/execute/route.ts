// POST /api/growth-maps/[id]/execute — run the flow

import { NextRequest, NextResponse }  from 'next/server'
import { getAuthContext }             from '@/lib/auth'
import { executeGrowthMap }           from '@/lib/growth-map-engine'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const result = await executeGrowthMap(id, ctx.company.id)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao executar fluxo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
