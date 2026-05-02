// POST /api/leads/manage/import
// Bulk-imports leads from a CSV payload.
//
// Body:
//   { company_id: string, csv: string }
//
// CSV format (header row required):
//   name, email, phone, source, notes
//   (only `name` is required per row)
//
// Returns:
//   { imported: number, skipped: number, errors: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

interface LeadRow {
  name:   string
  email?: string
  phone?: string
  source?: string
  notes?: string
}

function parseCsv(raw: string): LeadRow[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []   // header + at least 1 row

  // Normalise headers: lowercase, trim
  const headers = lines[0]
    .split(',')
    .map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))

  const rows: LeadRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] ?? '').trim().replace(/^"|"$/g, '')
    })

    const name = (obj.name ?? obj.nome ?? '').trim()
    if (!name) continue   // skip rows without a name

    rows.push({
      name,
      email:  obj.email  || undefined,
      phone:  obj.phone  || obj.telefone || undefined,
      source: obj.source || obj.fonte    || 'import',
      notes:  obj.notes  || obj.notas   || undefined,
    })
  }

  return rows
}

// Handle quoted fields with commas inside
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

export async function POST(req: NextRequest) {
  const body       = await readJsonObject(req)
  const company_id = body ? getString(body, 'company_id') : undefined
  const csv        = body ? getString(body, 'csv')        : undefined

  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  if (!csv?.trim()) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const rows = parseCsv(csv)
  if (rows.length === 0) {
    return NextResponse.json({
      imported: 0, skipped: 0,
      errors: ['No valid rows found. Make sure the CSV has a header row with at least a "name" column.'],
    })
  }

  const db = getSupabaseServerClient()
  const errors: string[] = []
  let imported = 0
  let skipped  = 0

  // Insert in chunks of 50
  const CHUNK = 50
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK).map(r => ({
      company_id,
      name:   r.name,
      email:  r.email  ?? null,
      phone:  r.phone  ?? null,
      source: r.source ?? 'import',
      notes:  r.notes  ?? null,
      status: 'new',
    }))

    const { data, error } = await db
      .from('leads')
      .insert(chunk)
      .select('id')

    if (error) {
      errors.push(`Chunk ${Math.floor(start / CHUNK) + 1}: ${error.message}`)
      skipped += chunk.length
    } else {
      imported += data?.length ?? 0
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
