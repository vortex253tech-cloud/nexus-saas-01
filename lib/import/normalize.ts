// Data normalization for client imports

export type ClientStatus = 'pending' | 'paid' | 'overdue'

// ─── Status normalization ──────────────────────────────────────

const STATUS_MAP: Record<string, ClientStatus> = {
  // Portuguese
  'em atraso':    'overdue',
  'inadimplente': 'overdue',
  'atrasado':     'overdue',
  'vencido':      'overdue',
  'vencida':      'overdue',
  'atraso':       'overdue',
  'ativo':        'pending',
  'ativa':        'pending',
  'ativado':      'pending',
  'em dia':       'pending',
  'pago':         'paid',
  'paga':         'paid',
  'quitado':      'paid',
  'quitada':      'paid',
  'liquidado':    'paid',
  'liquidada':    'paid',
  'ok':           'paid',
  'recebido':     'paid',
  'pendente':     'pending',
  'aguardando':   'pending',
  'aberto':       'pending',
  'aberta':       'pending',
  // English
  'overdue':      'overdue',
  'late':         'overdue',
  'delinquent':   'overdue',
  'active':       'pending',
  'paid':         'paid',
  'settled':      'paid',
  'closed':       'paid',
  'pending':      'pending',
  'open':         'pending',
  'outstanding':  'pending',
  'due':          'pending',
}

export function normalizeStatus(raw: string | undefined | null): ClientStatus {
  if (!raw) return 'pending'
  const key = raw.toLowerCase().trim()
  return STATUS_MAP[key] ?? 'pending'
}

// ─── Value normalization ───────────────────────────────────────

export function parseValue(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.max(0, raw)
  if (!raw) return 0

  // Strip currency symbols, whitespace, thousands-formatting chars we'll handle below
  const s = String(raw).replace(/[R$\s€£¥₹]/g, '').trim()
  if (!s) return 0

  let normalized: string

  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // "1.500,00" (BR) — last separator is comma → comma is decimal
    // "1,500.00" (US) — last separator is dot  → dot is decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      normalized = s.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = s.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // "1500,00" → comma as decimal  OR  "1,500" → comma as thousands
    const afterComma = s.split(',').pop() ?? ''
    if (afterComma.length === 3 && /^\d+$/.test(afterComma)) {
      // Thousands separator — "1,500"
      normalized = s.replace(',', '')
    } else {
      // Decimal — "1500,00"
      normalized = s.replace(',', '.')
    }
  } else {
    normalized = s
  }

  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : Math.max(0, n)
}

// ─── Phone normalization ───────────────────────────────────────

export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null
  // Keep digits, +, spaces, dashes, parens
  const stripped = String(raw).replace(/[^\d+\s\-()]/g, '').trim()
  if (!stripped) return null
  // If starts with digits and 10+ chars, assume BR and add +55
  if (/^\d{10,11}$/.test(stripped.replace(/\D/g, ''))) {
    return `+55${stripped.replace(/\D/g, '')}`
  }
  return stripped || null
}

// ─── Date normalization ────────────────────────────────────────

export function normalizeDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // Try ISO first — "2025-05-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // "DD/MM/YYYY" or "DD/MM/YY"
  const dmY = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (dmY) {
    const [, d, m, y] = dmY
    const year = y.length === 2 ? `20${y}` : y
    const date = new Date(`${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`)
    return isNaN(date.getTime()) ? null : date.toISOString()
  }

  // Fall back to JS Date parse
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ─── Origem normalization ──────────────────────────────────────

const VALID_ORIGENS = [
  'Indicação', 'Google Ads', 'Instagram', 'WhatsApp',
  'Site', 'LinkedIn', 'Prospecção', 'Parceiro', 'Outro',
]

export function normalizeOrigem(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  // Case-insensitive match against valid values
  const match = VALID_ORIGENS.find(o => o.toLowerCase() === s.toLowerCase())
  return match ?? 'Outro'
}

// ─── Full row normalization ────────────────────────────────────

export interface NormalizedClient {
  name:             string
  email:            string | null
  phone:            string | null
  status:           ClientStatus
  total_revenue:    number
  last_interaction: string | null
  origem:           string | null
  notes:            string | null
}

export function normalizeRow(raw: Record<string, string | undefined>): NormalizedClient | null {
  const name = (raw.name ?? '').trim()
  if (!name) return null  // name is required

  return {
    name,
    email:            raw.email?.trim() || null,
    phone:            normalizePhone(raw.phone),
    status:           normalizeStatus(raw.status),
    total_revenue:    parseValue(raw.value),
    last_interaction: normalizeDate(raw.last_interaction),
    origem:           normalizeOrigem(raw.origem),
    notes:            raw.notes?.trim() || null,
  }
}
