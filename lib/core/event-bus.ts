// NEXUS Core Engine — Event Bus
// Dual-layer: in-process EventEmitter (same-request) + Supabase persistence.
// Vercel serverless has no persistent process, so cross-request events use
// Supabase Realtime subscriptions from the client side.

import { EventEmitter }       from 'events'
import { createClient }       from '@supabase/supabase-js'
import type { NexusEvent, NexusEventType } from './types'

// In-process bus — lives for the lifetime of one serverless invocation.
class NexusEventEmitter extends EventEmitter {}
const _emitter = new NexusEventEmitter()
_emitter.setMaxListeners(50)

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Emit ────────────────────────────────────────────────────────────────────

export async function emitEvent<T = Record<string, unknown>>(
  type:       NexusEventType,
  company_id: string,
  payload:    T,
  source      = 'system',
): Promise<NexusEvent<T>> {
  const event: NexusEvent<T> = {
    id:         crypto.randomUUID(),
    type,
    company_id,
    payload,
    source,
    created_at: new Date().toISOString(),
  }

  // 1. Persist to Supabase (async, non-blocking)
  db()
    .from('nexus_events')
    .insert({
      id:         event.id,
      type:       event.type,
      company_id: event.company_id,
      payload:    event.payload,
      source:     event.source,
      created_at: event.created_at,
    })
    .then(() => {}, (err) => console.error('[event-bus] persist error:', err))

  // 2. Fire in-process listeners (same serverless invocation)
  _emitter.emit(type, event)
  _emitter.emit('*', event)

  return event
}

// ─── Subscribe (in-process, same invocation only) ────────────────────────────

export function onEvent<T = Record<string, unknown>>(
  type:     NexusEventType | '*',
  handler:  (event: NexusEvent<T>) => void,
): () => void {
  _emitter.on(type, handler as (e: NexusEvent) => void)
  return () => _emitter.off(type, handler as (e: NexusEvent) => void)
}

// ─── Query recent events ─────────────────────────────────────────────────────

export async function getRecentEvents(
  company_id: string,
  limit       = 50,
  type?:      NexusEventType,
): Promise<NexusEvent[]> {
  const supabase = db()
  let q = supabase
    .from('nexus_events')
    .select('*')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) q = q.eq('type', type)

  const { data } = await q
  return (data ?? []) as NexusEvent[]
}
