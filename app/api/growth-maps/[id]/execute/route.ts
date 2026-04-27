// POST /api/growth-maps/[id]/execute
// Enqueues a flow execution and returns the executionId.
// The caller can poll GET /api/growth-maps/[id]/executions/[execId] for status.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowQueue }                 from '@/lib/flow-engine/flow-queue'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const queue       = new FlowQueue()
    const executionId = await queue.enqueue(id, ctx.company.id)

    return NextResponse.json({ executionId, status: 'completed' }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao executar fluxo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
