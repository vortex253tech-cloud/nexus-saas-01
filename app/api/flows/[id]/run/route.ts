// POST /api/flows/[id]/run
// Enqueues (or runs synchronously) a flow for the current company.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowService }               from '@/lib/flow-engine/flow.service'
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
    const svc    = new FlowService()
    const result = await svc.runFlow(id, ctx.company.id)
    await incrementFlowExecutionUsage(ctx.company.id)
    return NextResponse.json({ ...result, status: 'queued' })
  } catch (err) {
    console.error('[flow-run]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
