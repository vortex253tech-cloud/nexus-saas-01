// POST /api/autopilot/run — trigger Auto-Pilot manually for the authenticated company

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { runAutoPilot } from '@/lib/autopilot'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await runAutoPilot(ctx.company.id, 'user')

  return NextResponse.json(result)
}
