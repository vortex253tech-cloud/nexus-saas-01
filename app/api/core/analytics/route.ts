// GET /api/core/analytics — full dashboard metrics

import { NextResponse }          from 'next/server'
import { getAuthContext }        from '@/lib/auth'
import { getDashboardMetrics }   from '@/lib/core/analytics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const metrics = await getDashboardMetrics(ctx.company.id)
  return NextResponse.json(metrics)
}
