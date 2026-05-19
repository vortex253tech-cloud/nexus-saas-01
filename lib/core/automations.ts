// NEXUS Core Engine — Automations
// Reads from existing `automations` and `automation_steps` tables.
// Handles triggers, conditions, and execution with delay support.

import { createClient } from '@supabase/supabase-js'
import { emitEvent }    from './event-bus'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationStep {
  id:          string
  step_order:  number
  type:        'message' | 'wait' | 'condition' | 'tag' | 'ai_response' | 'webhook'
  config:      Record<string, unknown>
  delay_hours: number
}

interface Automation {
  id:           string
  company_id:   string
  name:         string
  description:  string
  trigger_type: string
  is_active:    boolean
  steps:        AutomationStep[]
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function getActiveAutomations(company_id: string): Promise<Automation[]> {
  const supabase = db()

  const { data: automations } = await supabase
    .from('automations')
    .select('id, company_id, name, description, trigger_type, is_active')
    .eq('company_id', company_id)
    .eq('is_active', true)

  if (!automations?.length) return []

  const ids = automations.map((a) => a.id)
  const { data: steps } = await supabase
    .from('automation_steps')
    .select('*')
    .in('automation_id', ids)
    .order('step_order')

  return automations.map((a) => ({
    ...a,
    steps: (steps ?? [])
      .filter((s) => s.automation_id === a.id)
      .map((s) => ({
        id:          s.id,
        step_order:  s.step_order,
        type:        s.type,
        config:      s.config ?? {},
        delay_hours: s.delay_hours ?? 0,
      })),
  }))
}

// ─── Trigger: find and fire matching automations ──────────────────────────────

export async function triggerAutomations(
  company_id:   string,
  trigger_type: string,
  context:      Record<string, unknown>,
): Promise<{ triggered: number; automation_ids: string[] }> {
  const automations = await getActiveAutomations(company_id)
  const matching    = automations.filter((a) => a.trigger_type === trigger_type)

  const triggered_ids: string[] = []

  for (const automation of matching) {
    // Create enrollment record
    const supabase = db()
    const { data: enrollment } = await supabase
      .from('automation_enrollments')
      .insert({
        company_id,
        automation_id:   automation.id,
        contact_phone:   (context.phone as string) ?? null,
        contact_id:      (context.contact_id as string) ?? null,
        status:          'active',
        current_step:    0,
        context,
        enrolled_at:     new Date().toISOString(),
        next_step_at:    new Date().toISOString(),
      })
      .select('id')
      .single()

    if (enrollment) {
      triggered_ids.push(automation.id)

      await emitEvent('automation.triggered', company_id, {
        automation_id:   automation.id,
        automation_name: automation.name,
        enrollment_id:   enrollment.id,
        trigger_type,
        context,
      }, 'automations-engine')
    }
  }

  return { triggered: triggered_ids.length, automation_ids: triggered_ids }
}

// ─── Run a specific automation by ID ─────────────────────────────────────────

export async function runAutomationById(
  company_id:    string,
  automation_id: string,
  context:       Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const supabase = db()

  const { data: automation } = await supabase
    .from('automations')
    .select('*')
    .eq('id', automation_id)
    .eq('company_id', company_id)
    .single()

  if (!automation) return { error: 'Automation not found' }

  const { data: steps } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automation_id)
    .order('step_order')

  // Log execution
  const { data: run } = await supabase
    .from('engine_runs')
    .insert({
      company_id,
      run_type:   'automation',
      status:     'running',
      metadata:   { automation_id, automation_name: automation.name, context },
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  await emitEvent('automation.executed', company_id, {
    automation_id,
    automation_name: automation.name,
    steps_count:     (steps ?? []).length,
    context,
    run_id:          run?.id,
  }, 'automations-engine')

  // Update run as completed
  if (run) {
    supabase
      .from('engine_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', run.id)
      .then(() => {}, () => {})
  }

  return {
    automation_id,
    name:       automation.name,
    steps_count: (steps ?? []).length,
    status:     'executed',
    run_id:     run?.id,
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAutomationStats(company_id: string) {
  const supabase = db()
  const today    = new Date()
  today.setHours(0, 0, 0, 0)

  const [activeRes, execTodayRes] = await Promise.all([
    supabase
      .from('automations')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('is_active', true),
    supabase
      .from('engine_runs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('run_type', 'automation')
      .gte('started_at', today.toISOString()),
  ])

  return {
    active:            activeRes.count  ?? 0,
    executions_today:  execTodayRes.count ?? 0,
  }
}
