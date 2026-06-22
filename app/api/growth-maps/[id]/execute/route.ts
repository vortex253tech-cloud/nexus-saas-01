// POST /api/growth-maps/[id]/execute
// Enqueues a flow execution and returns the executionId.
// The caller can poll GET /api/growth-maps/[id]/executions/[execId] for status.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowQueue }                 from '@/lib/flow-engine/flow-queue'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getFlowExecutionUsage, incrementFlowExecutionUsage } from '@/lib/usage'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params

  const denied = await denyIfCannot('automations')
  if (denied) return denied

  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const usage = await getFlowExecutionUsage(ctx.company.id)
  const limited = await denyIfAtLimit('max_flow_executions', usage)
  if (limited) return limited

  try {
    const queue       = new FlowQueue()
    const executionId = await queue.enqueue(id, ctx.company.id)
    await incrementFlowExecutionUsage(ctx.company.id)

    return NextResponse.json({ executionId, status: 'completed' }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao executar fluxo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
