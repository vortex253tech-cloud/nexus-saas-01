// GET /api/growth-maps/[id]/executions
// Lists recent executions for a flow.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowRepository }            from '@/lib/flow-engine/flow-repository'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const repo       = new FlowRepository()
  const executions = await repo.listExecutions(id, ctx.company.id, 20)

  return NextResponse.json({ executions })
}
