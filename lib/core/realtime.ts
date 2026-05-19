// NEXUS Core Engine — Realtime
// Server-side utilities for Supabase Realtime.
// Cross-process communication uses the `nexus_events` table (Supabase Realtime).
// Client subscribes via useNexusRealtime hook (lib/hooks/use-nexus-realtime.ts).

import { createClient } from '@supabase/supabase-js'
import type { RealtimeMessage } from './types'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Broadcast via DB insert (Supabase Realtime picks it up) ─────────────────
// Clients subscribe to nexus_events table changes for their company.

export async function broadcastUpdate(
  company_id: string,
  channel:    string,
  data:       Record<string, unknown>,
): Promise<void> {
  const supabase = db()

  await supabase.from('nexus_events').insert({
    id:         crypto.randomUUID(),
    type:       'ai.action.completed',
    company_id,
    payload:    { channel, ...data },
    source:     'realtime',
    created_at: new Date().toISOString(),
  })
}

// ─── Notification ─────────────────────────────────────────────────────────────

export async function sendNotification(
  company_id: string,
  title:      string,
  message:    string,
  type:       'info' | 'success' | 'warning' | 'error' = 'info',
): Promise<void> {
  await broadcastUpdate(company_id, 'notifications', {
    notification: { title, message, type, id: crypto.randomUUID() },
  })
}

// ─── Dashboard sync pulse ─────────────────────────────────────────────────────

export async function syncDashboard(
  company_id: string,
  section:    string,
  data:       Record<string, unknown>,
): Promise<void> {
  await broadcastUpdate(company_id, `dashboard:${section}`, data)
}

// ─── Build the Realtime subscription config for client use ───────────────────
// Returns the config that the client hook should pass to Supabase Realtime.

export function getRealtimeConfig(company_id: string) {
  return {
    table:  'nexus_events',
    filter: `company_id=eq.${company_id}`,
    event:  'INSERT' as const,
  }
}

// ─── Construct message envelope ───────────────────────────────────────────────

export function buildMessage(
  company_id: string,
  channel:    string,
  data:       Record<string, unknown>,
  type:       RealtimeMessage['type'] = 'update',
): RealtimeMessage {
  return {
    type,
    company_id,
    channel,
    data,
    timestamp: new Date().toISOString(),
  }
}
