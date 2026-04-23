// POST /api/collections/run — charge all overdue clients for a company

import { NextRequest, NextResponse } from 'next/server'
import { getCompanyContext } from '@/lib/auth'
import { runCollections } from '@/lib/collections'

export async function POST(req: NextRequest) {
  const ctx = await getCompanyContext(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { charged, failed, results } = await runCollections(ctx.company.id)

  return NextResponse.json({ charged, failed, results })
}
