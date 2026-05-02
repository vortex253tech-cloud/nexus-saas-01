// UPDATE_LEAD_STATUS action — moves leads through the pipeline.
//
// Config:
//   status — target status: 'contacted' | 'converted' | 'lost'
//
// Input:
//   Records from lastOutput with { id } fields (output of a LEADS analysis node).

import { getSupabaseServerClient } from '@/lib/supabase'
import type { ActionFn, ActionResult } from './action.types'
import { extractRecords } from './action.types'

const VALID = new Set(['new', 'contacted', 'converted', 'lost'])

export const execute: ActionFn = async (config, context) => {
  const status = (config.status as string | undefined) ?? 'contacted'

  if (!VALID.has(status)) {
    return {
      success:   false,
      message:   `UPDATE_LEAD_STATUS: invalid status "${status}"`,
      processed: 0, succeeded: 0,
      errors:    [`Valid values: new | contacted | converted | lost`],
      payload:   { status },
    }
  }

  const db      = getSupabaseServerClient()
  const records = extractRecords(context.lastOutput)

  if (records.length === 0) {
    return {
      success:   true,
      message:   'UPDATE_LEAD_STATUS: no records to update',
      processed: 0, succeeded: 0, errors: [],
      payload:   { status },
    }
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'converted') patch.converted_at = new Date().toISOString()

  const errors: string[] = []
  let updated = 0

  for (const rec of records) {
    const id = rec.id as string | undefined
    if (!id) { errors.push('Record missing id — skipped'); continue }

    const { error } = await db
      .from('leads')
      .update(patch)
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) errors.push(`${id}: ${error.message}`)
    else updated++
  }

  return {
    success:   updated > 0 || records.length === 0,
    message:   `UPDATE_LEAD_STATUS: ${updated}/${records.length} leads → "${status}"`,
    processed: records.length,
    succeeded: updated,
    errors,
    payload:   { status, updated },
  }
}
