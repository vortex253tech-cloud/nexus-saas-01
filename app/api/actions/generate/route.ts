// POST /api/actions/generate — generate rule-based actions for the company

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { generateActions } from '@/lib/action-engine'

export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await generateActions(ctx.company.id)

  return NextResponse.json({
    inserted:    result.inserted,
    totalScore:  result.scores.length,
    overdueCount: result.overdueCount,
    totalOverdue: result.totalOverdue,
  })
}
