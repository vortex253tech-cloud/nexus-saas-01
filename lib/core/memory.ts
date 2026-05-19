// NEXUS Core Engine — Memory
// Reads/writes the existing `nexus_memory` table.
// Includes a simple in-process LRU cache to reduce DB round-trips.

import { createClient } from '@supabase/supabase-js'
import type { MemoryEntry, MemoryType } from './types'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── LRU cache (per-invocation) ──────────────────────────────────────────────

const MAX_CACHE = 200
const _cache = new Map<string, { entry: MemoryEntry; at: number }>()

function cacheKey(company_id: string, type: MemoryType, key: string) {
  return `${company_id}:${type}:${key}`
}

function cacheGet(k: string): MemoryEntry | null {
  const hit = _cache.get(k)
  if (!hit) return null
  // Check TTL
  const entry = hit.entry
  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    _cache.delete(k)
    return null
  }
  return entry
}

function cachePut(k: string, entry: MemoryEntry) {
  if (_cache.size >= MAX_CACHE) {
    // Evict oldest
    const oldest = [..._cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) _cache.delete(oldest[0])
  }
  _cache.set(k, { entry, at: Date.now() })
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getMemory(
  company_id: string,
  type:       MemoryType,
  key:        string,
): Promise<MemoryEntry | null> {
  const k = cacheKey(company_id, type, key)
  const cached = cacheGet(k)
  if (cached) return cached

  const supabase = db()
  const { data } = await supabase
    .from('nexus_memory')
    .select('*')
    .eq('company_id', company_id)
    .eq('type', type)
    .eq('key', key)
    .maybeSingle()

  if (!data) return null

  // Filter expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null

  const entry = data as MemoryEntry
  cachePut(k, entry)
  return entry
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function setMemory(
  company_id: string,
  type:       MemoryType,
  key:        string,
  value:      Record<string, unknown>,
  ttl_seconds?: number,
): Promise<void> {
  const expires_at = ttl_seconds
    ? new Date(Date.now() + ttl_seconds * 1000).toISOString()
    : null

  const row = {
    company_id,
    type,
    key,
    value,
    ttl_seconds:  ttl_seconds ?? null,
    expires_at,
    updated_at:   new Date().toISOString(),
  }

  const supabase = db()
  await supabase
    .from('nexus_memory')
    .upsert(row, { onConflict: 'company_id,type,key' })

  const k = cacheKey(company_id, type, key)
  cachePut(k, { ...row, value } as MemoryEntry)
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteMemory(
  company_id: string,
  type:       MemoryType,
  key:        string,
): Promise<void> {
  const supabase = db()
  await supabase
    .from('nexus_memory')
    .delete()
    .eq('company_id', company_id)
    .eq('type', type)
    .eq('key', key)

  _cache.delete(cacheKey(company_id, type, key))
}

// ─── List by type ─────────────────────────────────────────────────────────────

export async function listMemory(
  company_id: string,
  type:       MemoryType,
  limit       = 20,
): Promise<MemoryEntry[]> {
  const supabase = db()
  const { data } = await supabase
    .from('nexus_memory')
    .select('*')
    .eq('company_id', company_id)
    .eq('type', type)
    .order('updated_at', { ascending: false })
    .limit(limit)

  const now = new Date()
  return ((data ?? []) as MemoryEntry[]).filter(
    (e) => !e.expires_at || new Date(e.expires_at) > now,
  )
}

// ─── Convenience: AI conversation history ────────────────────────────────────

export async function appendAIHistory(
  company_id: string,
  session_id: string,
  role:       'user' | 'assistant',
  content:    string,
  max_entries = 20,
): Promise<void> {
  const existing = await getMemory(company_id, 'ai_history', session_id)
  const history: Array<{ role: string; content: string; ts: string }> =
    (existing?.value?.messages as typeof history) ?? []

  history.push({ role, content, ts: new Date().toISOString() })

  // Keep only last N entries
  const trimmed = history.slice(-max_entries)

  await setMemory(company_id, 'ai_history', session_id, { messages: trimmed }, 3600)
}

export async function getAIHistory(
  company_id: string,
  session_id: string,
): Promise<Array<{ role: string; content: string; ts: string }>> {
  const entry = await getMemory(company_id, 'ai_history', session_id)
  return (entry?.value?.messages as Array<{ role: string; content: string; ts: string }>) ?? []
}
