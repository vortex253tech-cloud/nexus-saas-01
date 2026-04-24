// POST /api/cron/automations — process pending automation enrollments
// Protected by CRON_SECRET. Runs hourly via Vercel Cron.

import { NextRequest, NextResponse } from 'next/server'
import { processAutomationEnrollments } from '@/lib/automations-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processAutomationEnrollments()
  return NextResponse.json(result)
}
