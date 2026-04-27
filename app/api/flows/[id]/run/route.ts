// POST /api/flows/[id]/run
// Enqueues (or runs synchronously) a flow for the current company.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { FlowService }               from '@/lib/flow-engine/flow.service'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx    = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const svc    = new FlowService()
    const result = await svc.runFlow(id, ctx.company.id)
    return NextResponse.json({ ...result, status: 'queued' })
  } catch (err) {
    console.error('[flow-run]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
