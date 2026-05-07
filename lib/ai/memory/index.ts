// ─── AI persistent memory ─────────────────────────────────────────────────────
// Stores and retrieves key business facts across conversation sessions.
// Memory is scoped per company and injected into the AI system prompt.

import { getSupabaseServerClient } from '@/lib/supabase'

export interface MemoryEntry {
  key:        string
  value:      string
  source:     string
  importance: number
}

// ─── Load memory ─────────────────────────────────────────────────────────────
// Returns top-20 most important facts for the company.

export async function loadMemory(companyId: string): Promise<MemoryEntry[]> {
  try {
    const db = getSupabaseServerClient()
    const { data } = await db
      .from('ai_memory')
      .select('key, value, source, importance')
      .eq('company_id', companyId)
      .order('importance', { ascending: false })
      .limit(20)

    return (data ?? []) as MemoryEntry[]
  } catch {
    return []
  }
}

// ─── Format memory for system prompt ─────────────────────────────────────────

export function formatMemoryForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return ''

  const lines = entries.map(e => `• ${e.key}: ${e.value}`)
  return `\nMEMÓRIA PERSISTENTE (informações acumuladas sobre este negócio):\n${lines.join('\n')}`
}

// ─── Save or update a memory entry ───────────────────────────────────────────

export async function saveMemory(
  companyId:  string,
  key:        string,
  value:      string,
  source:     'user_stated' | 'ai_inferred' | 'document' = 'ai_inferred',
  importance: number = 5,
): Promise<void> {
  try {
    const db = getSupabaseServerClient()
    await db.from('ai_memory').upsert(
      { company_id: companyId, key, value, source, importance, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,key' },
    )
  } catch (err) {
    console.warn('[memory] save failed:', err)
  }
}

// ─── Extract and save memory from a conversation turn ────────────────────────
// Called after each AI response to capture new facts.
// Uses simple heuristic patterns — no additional AI call needed.

export async function extractAndSaveMemory(
  companyId:    string,
  userMessage:  string,
  _aiResponse:  string,
): Promise<void> {
  const patterns: Array<{ regex: RegExp; key: string; importance: number }> = [
    { regex: /minha meta (?:é|e) (?:atingir |alcançar |faturar )?(.+)/i,          key: 'meta_negocio',    importance: 9 },
    { regex: /(?:meu |o )?faturamento (?:atual )?(?:é|e|está) (.+)/i,             key: 'faturamento_atual', importance: 7 },
    { regex: /(?:meu |o )?maior problema (?:é|e|são|sao) (.+)/i,                  key: 'problema_principal', importance: 8 },
    { regex: /(?:trabalho|atuo|opero) (?:no setor|na área|em) (.+)/i,             key: 'setor_atuacao',   importance: 6 },
    { regex: /tenho (?:cerca de |aproximadamente )?(\d+) clientes?/i,             key: 'qtd_clientes',    importance: 6 },
    { regex: /meu ticket médio (?:é|e|está) (?:de )?(.+)/i,                       key: 'ticket_medio',    importance: 7 },
    { regex: /(?:quero|preciso|estou tentando) (.{10,80})/i,                      key: 'objetivo_atual',  importance: 5 },
  ]

  for (const { regex, key, importance } of patterns) {
    const match = userMessage.match(regex)
    if (match?.[1]) {
      const value = match[1].trim().slice(0, 200)
      if (value.length > 3) {
        await saveMemory(companyId, key, value, 'user_stated', importance)
      }
    }
  }
}
