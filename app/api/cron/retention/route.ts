// GET/POST /api/cron/retention
// Vercel cron job — calls retention/detect for every active company.
// Schedule in vercel.json: { "path": "/api/cron/retention", "schedule": "0 9 * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function run() {
  // Authorize via CRON_SECRET
  const db = getSupabaseServerClient()

  const { data: companies, error } = await db
    .from('companies')
    .select('id')

  if (error) return { error: error.message }

  const ids = (companies ?? []).map((c: { id: string }) => c.id)
  const results: Record<string, unknown> = {}

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  for (const company_id of ids) {
    try {
      const res = await fetch(`${base}/api/retention/detect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id, inactive_days: 30 }),
      })
      results[company_id] = await res.json()
    } catch (err) {
      results[company_id] = { error: String(err) }
    }
  }

  return { processed: ids.length, results }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
