// POST /api/import/clients
// Bulk-insert normalized client rows into the clients table.
// Body: { rows: NormalizedClient[] }

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { normalizeRow }              from '@/lib/import/normalize'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).rows)) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })
  }

  const rawRows = (body as { rows: Record<string, string | undefined>[] }).rows

  if (rawRows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0, errors: [] })
  }

  if (rawRows.length > 2000) {
    return NextResponse.json({ error: 'Máximo de 2000 linhas por importação' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  let inserted = 0
  let skipped  = 0
  const errors: string[] = []

  // Process in batches of 200 to avoid payload limits
  const BATCH = 200
  for (let offset = 0; offset < rawRows.length; offset += BATCH) {
    const batch = rawRows.slice(offset, offset + BATCH)

    const toInsert = batch
      .map((raw, i) => {
        try {
          const normalized = normalizeRow(raw)
          if (!normalized) { skipped++; return null }
          return {
            company_id:       ctx.companyId,
            name:             normalized.name,
            email:            normalized.email,
            phone:            normalized.phone,
            status:           normalized.status,
            total_revenue:    normalized.total_revenue,
            last_interaction: normalized.last_interaction,
            origem:           normalized.origem,
            notes:            normalized.notes,
          }
        } catch (e) {
          errors.push(`Linha ${offset + i + 1}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
          return null
        }
      })
      .filter(Boolean) as Record<string, unknown>[]

    if (toInsert.length === 0) continue

    const { data, error } = await db.from('clients').insert(toInsert).select('id')

    if (error) {
      // Table may be missing last_interaction column — retry without it
      if (error.message.includes('last_interaction')) {
        const fallback = toInsert.map(({ last_interaction: _li, ...rest }) => rest)
        const { data: d2, error: e2 } = await db.from('clients').insert(fallback).select('id')
        if (e2) {
          errors.push(`Batch ${Math.floor(offset / BATCH) + 1}: ${e2.message}`)
        } else {
          inserted += d2?.length ?? 0
        }
      } else {
        errors.push(`Batch ${Math.floor(offset / BATCH) + 1}: ${error.message}`)
      }
    } else {
      inserted += data?.length ?? 0
    }
  }

  return NextResponse.json({ inserted, skipped, errors })
}
