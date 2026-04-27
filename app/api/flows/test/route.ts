// GET /api/flows/test
// Runs a hardcoded mock flow (TRIGGER → ANALYSIS → RESULT) without hitting the DB.
// Safe to call from the browser to verify the engine works end-to-end.

import { NextResponse }        from 'next/server'
import { FlowEngineService }   from '@/lib/flow-engine/flow-engine.service'
import { FlowNodeType }        from '@/lib/flow-engine/types'
import type { FlowNode, FlowEdge } from '@/lib/flow-engine/types'

const MOCK_NODES: FlowNode[] = [
  {
    id:     'trigger-1',
    type:   FlowNodeType.TRIGGER,
    label:  'Start',
    config: { condition: 'always=true' },
  },
  {
    id:     'analysis-1',
    type:   FlowNodeType.ANALYSIS,
    label:  'Check invoices',
    config: { source: 'invoices' },
  },
  {
    id:     'result-1',
    type:   FlowNodeType.RESULT,
    label:  'Done',
    config: {},
  },
]

const MOCK_EDGES: FlowEdge[] = [
  { id: 'e1', source: 'trigger-1',  target: 'analysis-1' },
  { id: 'e2', source: 'analysis-1', target: 'result-1'   },
]

export async function GET() {
  try {
    const engine = new FlowEngineService()
    const result = await engine.executeFlowDirect(
      MOCK_NODES,
      MOCK_EDGES,
      'test-company',
      { always: 'true' },
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[flow-test]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
