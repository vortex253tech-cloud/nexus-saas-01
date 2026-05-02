// CREATE_LEAD action — creates a new lead in the leads table.
// Used by flows to turn automation triggers into captured leads.
//
// Config:
//   source?  — where this lead came from (default: "flow")
//   status?  — initial status (default: "new")
//   notes?   — static notes to attach
//
// Input (from lastOutput / variables):
//   Records are expected to carry { name, email?, phone? } fields.
//   If lastOutput has no records, falls back to config.name / config.email / config.phone.

import { getSupabaseServerClient } from '@/lib/supabase'
import type { ActionFn, ActionResult } from './action.types'
import { extractRecords, renderTemplate } from './action.types'

export const execute: ActionFn = async (config, context) => {
  const db      = getSupabaseServerClient()
  const source  = (config.source  as string | undefined) ?? 'flow'
  const status  = (config.status  as string | undefined) ?? 'new'
  const noteTpl = (config.notes   as string | undefined) ?? ''

  const records = extractRecords(context.lastOutput)

  // If no upstream records, try to build a single lead from config / variables
  const targets: Array<Record<string, unknown>> = records.length > 0
    ? records
    : [{
        name:  config.name  ?? context.variables.name  ?? '',
        email: config.email ?? context.variables.email ?? null,
        phone: config.phone ?? context.variables.phone ?? null,
      }]

  const errors: string[]  = []
  let   created = 0

  for (const rec of targets) {
    const name = String(rec.name ?? '').trim()
    if (!name) {
      errors.push(`Skipped record — missing name: ${JSON.stringify(rec)}`)
      continue
    }

    const email = String(rec.email ?? '').trim() || null
    const phone = String(rec.phone ?? '').trim() || null
    const notes = noteTpl ? renderTemplate(noteTpl, rec as Record<string, unknown>) : null

    const { error } = await db
      .from('leads')
      .insert({
        company_id: context.companyId,
        name,
        email,
        phone,
        source,
        notes,
        status,
      })

    if (error) {
      errors.push(`${name}: ${error.message}`)
    } else {
      created++
    }
  }

  const result: ActionResult = {
    success:   created > 0 || targets.length === 0,
    message:   `CREATE_LEAD: ${created}/${targets.length} leads created`,
    processed: targets.length,
    succeeded: created,
    errors,
    payload:   { source, status, created },
  }

  return result
}
