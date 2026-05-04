// GET    /api/sales/leads/[id] — single lead + actions + messages
// PATCH  /api/sales/leads/[id] — update lead fields
// DELETE /api/sales/leads/[id] — soft delete (status = 'lost')

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { classifyLead, type LeadStatus } from '@/lib/sales-engine'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: Context) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  const { data: lead, error } = await db
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Load latest conversation + messages
  const { data: conv } = await db
    .from('sales_conversations')
    .select('id, status, created_at')
    .eq('lead_id', id)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const messages = conv ? await db
    .from('sales_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
    .limit(50) : { data: [] }

  // Load actions
  const { data: actions } = await db
    .from('sales_actions')
    .select('id, type, status, payload, scheduled_for, executed_at, created_at')
    .eq('lead_id', id)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    data: {
      ...lead,
      tier:         classifyLead(lead.score as number),
      conversation: conv ?? null,
      messages:     messages.data ?? [],
      actions:      actions ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, context: Context) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Verify ownership first
  const { data: existing } = await db
    .from('leads')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Build safe update payload (only allowed fields)
  const allowed: Record<string, unknown> = {}

  const name   = getString(body, 'name')
  const phone  = getString(body, 'phone')
  const email  = getString(body, 'email')
  const notes  = getString(body, 'notes')
  const status = getString(body, 'status') as LeadStatus | null
  const score  = typeof body.score === 'number' ? body.score : null

  if (name  !== null) allowed.name  = name?.trim()
  if (phone !== null) allowed.phone = phone?.trim() ?? null
  if (email !== null) allowed.email = email?.trim() ?? null
  if (notes !== null) allowed.notes = notes?.trim() ?? null

  const validStatuses: LeadStatus[] = ['new', 'qualified', 'proposal', 'won', 'lost', 'nurture']
  if (status && validStatuses.includes(status)) allowed.status = status

  if (score !== null) allowed.score = Math.min(Math.max(Math.round(score), 0), 100)

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('leads')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, context: Context) {
  const { id } = await context.params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('leads')
    .update({ status: 'lost' })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
