// POST /api/collections/run — charge all overdue clients for a company

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { runCollections } from '@/lib/collections'

export async function POST(_req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { charged, failed, results } = await runCollections(ctx.company.id)

  return NextResponse.json({ charged, failed, results })
}
