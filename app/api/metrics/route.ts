// GET /api/metrics — unified financial metrics for the current tenant.
//
// Returns data from all canonical tables so dashboard and financeiro
// read the same numbers. Always authenticated — company_id comes from
// the session, never from client input.

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getUnifiedMetrics } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const metrics = await getUnifiedMetrics(auth.companyId)
    return NextResponse.json(metrics)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
