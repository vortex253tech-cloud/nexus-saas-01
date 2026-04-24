// POST /api/collections/run-email — charge all overdue clients with email

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { runEmailCollections } from '@/lib/collections'

export async function POST(_req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { charged, failed, results } = await runEmailCollections(ctx.company.id)

  return NextResponse.json({ charged, failed, results })
}
