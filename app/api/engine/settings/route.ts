// GET|POST /api/engine/settings — Revenue Engine safety controls
//
// GET  → current settings for tenant
// POST → update: autopilot_enabled, approval_mode, max_actions_per_day

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getNumber, getString, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('companies')
    .select('autopilot_enabled, approval_mode, max_actions_per_day')
    .eq('id', auth.companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    autopilot_enabled:    (data as { autopilot_enabled?: boolean })?.autopilot_enabled ?? false,
    approval_mode:        (data as { approval_mode?: string })?.approval_mode ?? 'auto',
    max_actions_per_day:  (data as { max_actions_per_day?: number })?.max_actions_per_day ?? 20,
  })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  // autopilot_enabled — boolean
  if ('autopilot_enabled' in body) {
    updates.autopilot_enabled = Boolean(body.autopilot_enabled)
  }

  // approval_mode — 'auto' | 'manual'
  const mode = getString(body, 'approval_mode')
  if (mode) {
    if (mode !== 'auto' && mode !== 'manual') {
      return NextResponse.json({ error: 'approval_mode must be "auto" or "manual"' }, { status: 400 })
    }
    updates.approval_mode = mode
  }

  // max_actions_per_day — integer 1–200
  const maxActions = getNumber(body, 'max_actions_per_day')
  if (maxActions != null) {
    if (maxActions < 1 || maxActions > 200) {
      return NextResponse.json({ error: 'max_actions_per_day must be between 1 and 200' }, { status: 400 })
    }
    updates.max_actions_per_day = Math.floor(maxActions)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('companies')
    .update(updates)
    .eq('id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: updates })
}
