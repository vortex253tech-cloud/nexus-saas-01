// GET /api/flows/executions
// Lists all flow executions for the current company.
//
// Query params:
//   ?flowId=<uuid>      — filter by flow   (optional)
//   ?status=<status>    — filter by status (optional)
//   ?limit=<n>          — max results, default 50, max 200 (optional)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowRepository }            from '@/lib/flow-engine/flow-repository'
import type { ExecutionStatus }      from '@/lib/flow-engine/types'

const VALID_STATUSES = new Set<ExecutionStatus>(['pending', 'running', 'completed', 'error'])

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const flowId = sp.get('flowId')  ?? undefined
  const rawSt  = sp.get('status')  ?? undefined
  const rawLim = sp.get('limit')   ?? '50'

  const status = (rawSt && VALID_STATUSES.has(rawSt as ExecutionStatus))
    ? (rawSt as ExecutionStatus)
    : undefined

  const limit  = Math.min(Math.max(1, parseInt(rawLim, 10) || 50), 200)

  const repo       = new FlowRepository()
  const executions = await repo.listAllExecutions(ctx.company.id, limit, flowId, status)

  return NextResponse.json({ executions, total: executions.length })
}
