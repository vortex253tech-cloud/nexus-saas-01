import { getSupabaseServerClient } from '@/lib/supabase'
import {
  extractRecords, emptyResult,
  type ActionContext, type ActionResult,
} from './action.types'

interface UpdateClientConfig {
  field:    string   // column to update, e.g. 'status'
  value:    unknown  // new value, e.g. 'contacted'
  idField?: string   // which field holds the client id (default: 'id')
  table?:   string   // override table name (default: 'clients')
}

// ─── UPDATE_CLIENT action ─────────────────────────────────────────────────────
// Updates a field on each client record coming from lastOutput.
// Scoped to the current company via company_id.

export async function execute(
  config:  Record<string, unknown>,
  context: ActionContext,
): Promise<ActionResult> {
  const cfg: UpdateClientConfig = {
    field:   config.field   as string,
    value:   config.value,
    idField: config.idField as string | undefined,
    table:   config.table   as string | undefined,
  }

  if (!cfg.field) {
    return {
      success:   false,
      message:   'UPDATE_CLIENT: missing required config field "field"',
      processed: 0, succeeded: 0, errors: [], payload: {},
    }
  }

  const records = extractRecords(context.lastOutput)
  if (records.length === 0) return emptyResult('UPDATE_CLIENT')

  const db      = getSupabaseServerClient()
  const table   = cfg.table   ?? 'clients'
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
    message:   `UPDATE_CLIENT: ${updated}/${records.length} records updated in "${table}" (${cfg.field} = ${String(cfg.value)})`,
    processed: records.length,
    succeeded: updated,
    errors,
    payload:   { table, field: cfg.field, value: cfg.value, updatedIds },
  }
}
