import { getSupabaseServerClient } from '@/lib/supabase'
import {
  extractRecords, emptyResult,
  type ActionContext, type ActionResult,
} from './action.types'

interface UpdateFinancialConfig {
  field:    string   // column to update, e.g. 'status'
  value:    unknown  // new value, e.g. 'reviewed'
  table?:   string   // target table (default: 'financeiro')
  idField?: string   // which field holds the record id (default: 'id')
}

// ─── UPDATE_FINANCIAL action ──────────────────────────────────────────────────
// Updates a field on each financial record coming from lastOutput.
// Scoped to the current company via company_id.

export async function execute(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const cfg: UpdateFinancialConfig = {
    field:   config.field   as string,
    value:   config.value,
    table:   config.table   as string | undefined,
    idField: config.idField as string | undefined,
  }

  if (!cfg.field) {
    return {
      success:   false,
      message:   'UPDATE_FINANCIAL: missing required config field "field"',
      processed: 0, succeeded: 0, errors: [], payload: {},
    }
  }

  const records = extractRecords(context.lastOutput)
  if (records.length === 0) return emptyResult('UPDATE_FINANCIAL')

  const db      = getSupabaseServerClient()
  const table   = cfg.table   ?? 'financeiro'
  const idField = cfg.idField ?? 'id'

  let updated = 0
  const errors: string[] = []
  const updatedIds: string[] = []

  for (const record of records) {
    const id = record[idField] as string | undefined
    if (!id) continue

    const { error } = await db
      .from(table)
      .update({ [cfg.field]: cfg.value })
      .eq('id', id)
      .eq('company_id', context.companyId)

    if (error) {
      errors.push(`${id}: ${error.message}`)
    } else {
      updated++
      updatedIds.push(id)
    }
  }

  return {
    success:   updated > 0 || records.length === 0,
    message:   `UPDATE_FINANCIAL: ${updated}/${records.length} records updated in "${table}" (${cfg.field} = ${String(cfg.value)})`,
    processed: records.length,
    succeeded: updated,
    errors,
    payload:   { table, field: cfg.field, value: cfg.value, updatedIds },
  }
}
