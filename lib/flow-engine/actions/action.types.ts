// ─── Shared types for all action handlers ────────────────────────────────────

export interface ActionContext {
  companyId:   string
  executionId: string
  flowId:      string
  lastOutput:  unknown
  variables:   Record<string, unknown>
}

export interface ActionResult {
  success:   boolean
  message:   string
  processed: number
  succeeded: number
  errors:    string[]
  /** What was sent / mutated — for traceability in logs */
  payload:   Record<string, unknown>
}

export type ActionFn = (
  config:  Record<string, unknown>,
  context: ActionContext,
) => Promise<ActionResult>

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Extracts the record array from whatever shape lastOutput is. */
export function extractRecords(lastOutput: unknown): Record<string, unknown>[] {
  if (!lastOutput) return []
  const out = lastOutput as Record<string, unknown>
  if (Array.isArray(out.records)) return out.records as Record<string, unknown>[]
  if (Array.isArray(lastOutput))  return lastOutput as Record<string, unknown>[]
  return []
}

/** Resolves `{{key}}` placeholders in a template string. */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return String(data[key] ?? data[key.toLowerCase()] ?? `{{${key}}}`)
  })
}

export function emptyResult(actionType: string): ActionResult {
  return {
    success:   true,
    message:   `${actionType}: no records to process`,
    processed: 0,
    succeeded: 0,
    errors:    [],
    payload:   {},
  }
}
