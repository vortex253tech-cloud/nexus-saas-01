// GET /api/core/status — system health check

import { NextResponse }        from 'next/server'
import { getAuthContext }      from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAutomationStats }  from '@/lib/core/automations'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()
  const checks: Record<string, 'ok' | 'error'> = {}

  // DB connectivity
  try {
    await supabase.from('companies').select('id').limit(1)
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  // WhatsApp table
  try {
    await supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('company_id', ctx.company.id)
    checks.whatsapp = 'ok'
  } catch {
    checks.whatsapp = 'error'
  }

  // Events table
  try {
    await supabase.from('nexus_events').select('id', { count: 'exact', head: true }).eq('company_id', ctx.company.id).limit(1)
    checks.events = 'ok'
  } catch {
    checks.events = 'error'
  }

  // Memory table
  try {
    await supabase.from('nexus_memory').select('id', { count: 'exact', head: true }).eq('company_id', ctx.company.id).limit(1)
    checks.memory = 'ok'
  } catch {
    checks.memory = 'error'
  }

  // AI
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'ok' : 'error'

  // Automations
  let automations_active = 0
  try {
    const stats = await getAutomationStats(ctx.company.id)
    automations_active = stats.active
    checks.automations = 'ok'
  } catch {
    checks.automations = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  return NextResponse.json({
    status:            allOk ? 'healthy' : 'degraded',
    checks,
    automations_active,
    company_id:        ctx.company.id,
    timestamp:         new Date().toISOString(),
  })
}
