// GET|POST /api/cron/charge — Vercel cron: daily debt collection (09:00 BRT)
// Vercel sends Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { runCollections } from '@/lib/collections'

export const dynamic = 'force-dynamic'

async function handler(req: NextRequest) {
  // Verify Vercel cron secret
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()

  // Get all active companies
  const { data: companies } = await db.from('companies').select('id')

  if (!companies || companies.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, charged: 0, failed: 0 })
  }

  let totalCharged = 0
  let totalFailed  = 0

  for (const company of companies) {
    const { charged, failed } = await runCollections(company.id as string)
    totalCharged += charged
    totalFailed  += failed
  }

  console.log(
    `[Cron/charge] ${new Date().toISOString()} — ` +
    `companies: ${companies.length}, charged: ${totalCharged}, failed: ${totalFailed}`
  )

  return NextResponse.json({
    ok:        true,
    companies: companies.length,
    charged:   totalCharged,
    failed:    totalFailed,
  })
}

export const GET  = handler
export const POST = handler
