// GET  /api/leads/manage?company_id=... — list leads with stats
// POST /api/leads/manage                — create a single lead

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const status = req.nextUrl.searchParams.get('status') ?? undefined   // filter
  const search = req.nextUrl.searchParams.get('q')      ?? undefined   // name/email/phone search

  const db = getSupabaseServerClient()

  let query = db
    .from('leads')
    .select('*')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let leads = data ?? []

  // Client-side search (simple; avoid adding DB index for search)
  if (search) {
    const q = search.toLowerCase()
    leads = leads.filter(l =>
      (l.name  as string)?.toLowerCase().includes(q) ||
      (l.email as string)?.toLowerCase().includes(q) ||
      (l.phone as string)?.toLowerCase().includes(q)
    )
  }

  // Stats
  const total     = leads.length
  const newCount  = leads.filter(l => l.status === 'new').length
  const contacted = leads.filter(l => l.status === 'contacted').length
  const converted = leads.filter(l => l.status === 'converted').length
  const lost      = leads.filter(l => l.status === 'lost').length
  const rate      = total > 0 ? Math.round((converted / total) * 100) : 0

  return NextResponse.json({
    data: leads,
    meta: { total, new: newCount, contacted, converted, lost, conversion_rate: rate },
  })
}

// ─── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body       = await readJsonObject(req)
  const company_id = body ? getString(body, 'company_id') : undefined
  const name       = body ? getString(body, 'name')       : undefined
  const email      = body ? getString(body, 'email')      : undefined
  const phone      = body ? getString(body, 'phone')      : undefined
  const source     = body ? getString(body, 'source')     : 'manual'
  const notes      = body ? getString(body, 'notes')      : undefined

  if (!company_id || !name?.trim()) {
    return NextResponse.json({ error: 'company_id and name required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('leads')
    .insert({
      company_id,
      name:   name.trim(),
      email:  email?.trim() || null,
      phone:  phone?.trim() || null,
      source: source ?? 'manual',
      notes:  notes?.trim() || null,
      status: 'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
