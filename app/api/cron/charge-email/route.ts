// POST /api/cron/charge-email — D+1 / D+3 / D+7 automated email collection
// Protected by CRON_SECRET. Call via Vercel Cron or external scheduler (daily).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import {
  chargeClientByEmail,
  getDaysOverdue,
  type CollectionClient,
  type CollectionCompany,
} from '@/lib/collections'

// Days that trigger an automatic email wave
const WAVE_DAYS = [1, 3, 7]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()

  // 1. Fetch all overdue clients that have an email across all companies
  const { data: clients } = await db
    .from('clients')
    .select('id, name, phone, email, total_revenue, due_date, status, company_id')
    .eq('status', 'overdue')
    .not('email', 'is', null)

  if (!clients || clients.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0 })
  }

  // 2. Keep only clients on a wave day (D+1, D+3, D+7)
  const targets = clients.filter(c => {
    if (!c.due_date) return false
    return WAVE_DAYS.includes(getDaysOverdue(c.due_date as string))
  })

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: clients.length })
  }

  // 3. Skip clients that already received an email today (dedup by created_at date)
  const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(); tomorrowStart.setHours(0, 0, 0, 0); tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const targetIds = targets.map(c => c.id as string)

  const { data: todayLogs } = await db
    .from('collection_logs')
    .select('client_id')
    .in('client_id', targetIds)
    .eq('method', 'email')
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', tomorrowStart.toISOString())

  const alreadySentToday = new Set((todayLogs ?? []).map(l => l.client_id as string))
  const toSend = targets.filter(c => !alreadySentToday.has(c.id as string))

  if (toSend.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: targets.length })
  }

  // 4. Fetch company names (batch)
  const companyIds = [...new Set(toSend.map(c => c.company_id as string))]
  const { data: companies } = await db
    .from('companies')
    .select('id, nome')
    .in('id', companyIds)

  const companyMap = new Map<string, string>(
    (companies ?? []).map(co => [co.id as string, (co.nome as string) ?? 'Empresa'])
  )

  // 5. Send emails sequentially
  let sent   = 0
  let failed = 0

  for (const client of toSend) {
    const companyId = client.company_id as string
    const company: CollectionCompany = {
      id:   companyId,
      nome: companyMap.get(companyId) ?? 'Empresa',
    }

    const result = await chargeClientByEmail(client as unknown as CollectionClient, company)
    if (result.success) sent++
    else failed++
  }

  return NextResponse.json({
    sent,
    failed,
    skipped: alreadySentToday.size,
    total:   targets.length,
  })
}
