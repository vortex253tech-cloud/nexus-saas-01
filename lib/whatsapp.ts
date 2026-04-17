// ─── WhatsApp Integration — Meta Cloud API ─────────────────────
// Server-side only. Never import in client components.
// Fallback: simulation + log if credentials not set.

// ─── Types ─────────────────────────────────────────────────────

export interface SendWhatsAppParams {
  phone: string   // E.164 format: +5511999999999
  message: string
}

export interface WhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
  simulated?: boolean
}

// ─── Phone normalizer ─────────────────────────────────────────

export function normalizePhone(phone: string): string {
  // Remove everything except digits and leading +
  const digits = phone.replace(/[^\d+]/g, '')
  // If starts with 0, assume Brazil and add country code
  if (digits.startsWith('0')) return `+55${digits.slice(1)}`
  // If no country code (less than 13 digits for Brazil), add +55
  if (!digits.startsWith('+') && digits.length <= 11) return `+55${digits}`
  // Ensure starts with +
  if (!digits.startsWith('+')) return `+${digits}`
  return digits
}

// ─── Message builder ──────────────────────────────────────────

export function buildWhatsAppMessage(params: {
  nomeEmpresa: string
  actionTitulo: string
  actionDescricao: string
  impactoEstimado: number
}): string {
  const impactoFmt = `R$ ${Math.round(params.impactoEstimado).toLocaleString('pt-BR')}`
  return [
    `🎯 *NEXUS · Ação Identificada*`,
    `Empresa: ${params.nomeEmpresa}`,
    ``,
    `*${params.actionTitulo}*`,
    `${params.actionDescricao}`,
    ``,
    `💰 Impacto estimado: *${impactoFmt}/mês*`,
    ``,
    `Acesse seu dashboard para ver os detalhes e próximos passos.`,
  ].join('\n')
}

// ─── Send via Meta Cloud API ───────────────────────────────────

async function sendViaMetaAPI(phone: string, message: string): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }

  if (!res.ok || data.error) {
    return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
  }

  return { success: true, messageId: data.messages?.[0]?.id }
}

// ─── Main send function ────────────────────────────────────────

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<WhatsAppResult> {
  const normalized = normalizePhone(params.phone)

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    // No credentials — simulate
    console.log(`[WhatsApp Simulation] To: ${normalized}`)
    console.log(`[WhatsApp Simulation] Message: ${params.message}`)
    return { success: true, simulated: true }
  }

  try {
    return await sendViaMetaAPI(normalized, params.message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    return { success: false, error: msg }
  }
}
