// POST /api/recover — "Recuperar agora"
// Runs email collection + generates rule-based actions in one shot.

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { runEmailCollections } from '@/lib/collections'
import { generateActions } from '@/lib/action-engine'

export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const companyId = ctx.company.id

  // Run both in parallel
  const [emailResult, engineResult] = await Promise.allSettled([
    runEmailCollections(companyId),
    generateActions(companyId),
  ])

  const emails = emailResult.status === 'fulfilled'
    ? emailResult.value
    : { charged: 0, failed: 0, results: [] }

  const engine = engineResult.status === 'fulfilled'
    ? engineResult.value
    : { actions: [], scores: [], totalOverdue: 0, overdueCount: 0, inserted: 0 }

  return NextResponse.json({
    emails: {
      charged: emails.charged,
      failed:  emails.failed,
    },
    engine: {
      actionsGenerated: engine.inserted,
      overdueClients:   engine.overdueCount,
      totalOverdue:     engine.totalOverdue,
    },
    summary: [
      emails.charged > 0
        ? `${emails.charged} e-mail${emails.charged > 1 ? 's' : ''} de cobrança enviado${emails.charged > 1 ? 's' : ''}`
        : null,
      engine.inserted > 0
        ? `${engine.inserted} nova${engine.inserted > 1 ? 's' : ''} ação${engine.inserted > 1 ? 'ões' : ''} gerada${engine.inserted > 1 ? 's' : ''}`
        : null,
      emails.charged === 0 && engine.inserted === 0
        ? 'Nenhum cliente inadimplente no momento'
        : null,
    ].filter(Boolean).join(' · '),
  })
}
