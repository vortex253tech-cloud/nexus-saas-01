// GET  /api/sales/leads — list leads with pipeline stats
// POST /api/sales/leads — create a new lead

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { scoreLeadFromSource, classifyLead, type LeadSource, type LeadStatus } from '@/lib/sales-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as LeadStatus | null
  const limit  = parseInt(searchParams.get('limit') ?? '50', 10)

  const db = getSupabaseServerClient()

  let query = db
    .from('leads')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Pipeline stats ────────────────────────────────────────────────────────
  const { data: allLeads } = await db
    .from('leads')
    .select('status, score, created_at')
    .eq('company_id', auth.companyId)

  const today = new Date().toISOString().slice(0, 10)

  const stats = {
    total:        allLeads?.length ?? 0,
    today:        allLeads?.filter(l => l.created_at.slice(0, 10) === today).length ?? 0,
    new:          allLeads?.filter(l => l.status === 'new').length ?? 0,
    qualified:    allLeads?.filter(l => l.status === 'qualified').length ?? 0,
    proposal:     allLeads?.filter(l => l.status === 'proposal').length ?? 0,
    won:          allLeads?.filter(l => l.status === 'won').length ?? 0,
    lost:         allLeads?.filter(l => l.status === 'lost').length ?? 0,
    hot:          allLeads?.filter(l => classifyLead(l.score) === 'HOT').length ?? 0,
    warm:         allLeads?.filter(l => classifyLead(l.score) === 'WARM').length ?? 0,
    cold:         allLeads?.filter(l => classifyLead(l.score) === 'COLD').length ?? 0,
    conversion_rate: allLeads?.length
      ? Math.round((allLeads.filter(l => l.status === 'won').length / allLeads.length) * 100)
      : 0,
  }

  return NextResponse.json({ data: leads ?? [], stats })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const name   = getString(body, 'name')
  const source = (getString(body, 'source') ?? 'manual') as LeadSource
  const phone  = getString(body, 'phone')
  const email  = getString(body, 'email')
  const notes  = getString(body, 'notes')

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const validSources: LeadSource[] = ['whatsapp', 'instagram', 'site', 'manual', 'other']
  const safeSource: LeadSource = validSources.includes(source) ? source : 'manual'

  const initialScore = scoreLeadFromSource(safeSource)
    + (email ? 10 : 0)
    + (phone ? 10 : 0)

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('leads')
    .insert({
      company_id: auth.companyId,
      name:       name.trim(),
      source:     safeSource,
      phone:      phone?.trim() ?? null,
      email:      email?.trim() ?? null,
      notes:      notes?.trim() ?? null,
      score:      Math.min(initialScore, 100),
      status:     'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
