// GET /api/growth-maps/[id]/executions/[execId]
// Returns the status, logs and output of a single execution.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowRepository }            from '@/lib/flow-engine/flow-repository'

type Params = { params: Promise<{ id: string; execId: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { execId } = await params
  const ctx        = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const repo      = new FlowRepository()
  const execution = await repo.getExecution(execId)

  if (!execution || execution.companyId !== ctx.company.id) {
    return NextResponse.json({ error: 'Execução não encontrada' }, { status: 404 })
  }

  return NextResponse.json({ execution })
}
