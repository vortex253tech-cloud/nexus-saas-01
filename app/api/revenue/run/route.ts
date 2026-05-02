// POST /api/revenue/run
// Triggers the full revenue engine for the authenticated company.
// Segments clients → decides actions → generates payment links → sends messages.

import { NextResponse }        from 'next/server'
import { getAuthContext }      from '@/lib/auth'
import { runRevenuePipeline }  from '@/lib/revenue-engine/pipeline'

export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runRevenuePipeline(ctx.companyId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[revenue/run]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
