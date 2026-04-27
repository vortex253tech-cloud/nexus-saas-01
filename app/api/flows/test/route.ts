// GET /api/flows/test
// Smoke-tests the engine with a named-condition DECISION flow:
//
//   TRIGGER → ANALYSIS → DECISION (count > 5?)
//                           ├─ high_value → ACTION A
//                           ├─ low_value  → ACTION B
//                           └─ default    → RESULT
//
// Pass ?count=N to control which branch fires (default: 10 → high_value).

import { NextRequest, NextResponse } from 'next/server'
import { FlowEngineService }         from '@/lib/flow-engine/flow-engine.service'
import { FlowNodeType }              from '@/lib/flow-engine/types'
import type { FlowNode, FlowEdge }   from '@/lib/flow-engine/types'

export async function GET(req: NextRequest) {
  const count = parseInt(req.nextUrl.searchParams.get('count') ?? '10', 10)

  const NODES: FlowNode[] = [
    {
      id:     'trigger-1',
      type:   FlowNodeType.TRIGGER,
      label:  'Start',
      config: { condition: 'always=true' },
    },
    {
      id:     'analysis-1',
      type:   FlowNodeType.ANALYSIS,
      label:  'Load data',
      config: { source: 'invoices' },
    },
    {
      id:   'decision-1',
      type: FlowNodeType.DECISION,
      label: 'Value check',
      config: {
        rules: [
          { condition: 'high_value', expression: `lastOutput.count > 5` },
          { condition: 'low_value',  expression: `lastOutput.count <= 5` },
        ],
      },
    },
    {
      id:     'action-high',
      type:   FlowNodeType.ACTION,
      label:  'Priority action',
      config: { actionType: 'create_log' },
    },
    {
      id:     'action-low',
      type:   FlowNodeType.ACTION,
      label:  'Standard action',
      config: { actionType: 'create_log' },
    },
    {
      id:     'result-1',
      type:   FlowNodeType.RESULT,
      label:  'Done',
      config: {},
    },
  ]

  const EDGES: FlowEdge[] = [
    { id: 'e1', source: 'trigger-1',  target: 'analysis-1'  },
    { id: 'e2', source: 'analysis-1', target: 'decision-1'  },
    { id: 'e3', source: 'decision-1', target: 'action-high', condition: 'high_value' },
    { id: 'e4', source: 'decision-1', target: 'action-low',  condition: 'low_value'  },
    { id: 'e5', source: 'decision-1', target: 'result-1',    condition: 'default'    },
    { id: 'e6', source: 'action-high', target: 'result-1'   },
    { id: 'e7', source: 'action-low',  target: 'result-1'   },
  ]

  try {
    const engine = new FlowEngineService()
    const result = await engine.executeFlowDirect(
      NODES,
      EDGES,
      'test-company',
      { always: 'true', count },
    )

    const decision = result.logs.find(l => l.nodeType === FlowNodeType.DECISION)
    const branch   = (decision?.output as Record<string, unknown>)?.branch as string | undefined
    const skipped  = result.logs.filter(l => l.status === 'skipped').map(l => l.nodeId)

    return NextResponse.json({
      ok:       true,
      count,
      branch,
      skipped,
      steps:    result.logs.length,
      logs:     result.logs.map(l => ({
        node:    l.nodeId,
        type:    l.nodeType,
        status:  l.status,
        message: l.message,
        ms:      l.durationMs,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
