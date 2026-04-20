// ─── WhatsApp Integration — Meta Cloud API ─────────────────────
// Server-side only. Never import in client components.
// Fallback: simulation + log if credentials not set.

// ─── Types ─────────────────────────────────────────────────────

export interface SendWhatsAppParams {
  phone: string   // E.164: +5511999999999
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
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('0')) return `+55${digits.slice(1)}`
  if (!digits.startsWith('+') && digits.length <= 11) return `+55${digits}`
  if (!digits.startsWith('+')) return `+${digits}`
  return digits
}

// ─── Core send via Meta API ────────────────────────────────────

async function callMetaAPI(
  phoneNumberId: string,
  token: string,
  body: Record<string, unknown>
): Promise<WhatsAppResult> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const data = await res.json() as {
    messages?: Array<{ id: string }>
    error?: { message: string }
  }

  if (!res.ok || data.error) {
    return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
  }

  return { success: true, messageId: data.messages?.[0]?.id }
}

// ─── Send text message (outbound notification) ─────────────────

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<WhatsAppResult> {
  const normalized = normalizePhone(params.phone)
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp Simulation] To: ${normalized}`)
    console.log(`[WhatsApp Simulation] Message: ${params.message}`)
    return { success: true, simulated: true }
  }

  try {
    return await callMetaAPI(phoneNumberId, token, {
      messaging_product: 'whatsapp',
      to: normalized,
      type: 'text',
      text: { body: params.message },
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── Reply from webhook (uses phoneNumberId from the event) ────

export async function replyWhatsApp(params: {
  phoneNumberId: string
  to: string            // raw wa_id from webhook (sem +)
  message: string
}): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_TOKEN

  if (!token) {
    console.log(`[WhatsApp Simulation] Reply to: ${params.to}: ${params.message}`)
    return { success: true, simulated: true }
  }

  try {
    return await callMetaAPI(params.phoneNumberId, token, {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'text',
      text: { body: params.message },
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── Message builders ──────────────────────────────────────────

export function buildActionNotification(params: {
  nomeEmpresa: string
  actionTitulo: string
  actionDescricao: string
  impactoEstimado: number
}): string {
  const valor = `R$ ${Math.round(params.impactoEstimado).toLocaleString('pt-BR')}`
  return [
    `🎯 *NEXUS · Ação Identificada*`,
    `Empresa: ${params.nomeEmpresa}`,
    ``,
    `*${params.actionTitulo}*`,
    `${params.actionDescricao}`,
    ``,
    `💰 Impacto estimado: *${valor}/mês*`,
    ``,
    `Responda *ok* para confirmar ou acesse o dashboard para detalhes.`,
  ].join('\n')
}

export function buildStatusMessage(actions: Array<{
  titulo: string
  impacto_estimado: number
  prioridade: string
}>): string {
  if (actions.length === 0) {
    return `✅ *NEXUS* — Nenhuma ação pendente no momento.\n\nAcesse o dashboard para gerar um novo diagnóstico.`
  }

  const lista = actions
    .slice(0, 5)
    .map((a, i) => {
      const valor = `R$ ${Math.round(a.impacto_estimado).toLocaleString('pt-BR')}`
      const prio = a.prioridade === 'critica' ? '🔴' : a.prioridade === 'alta' ? '🟠' : '🟡'
      return `${prio} *${i + 1}. ${a.titulo}*\n   ${valor}/mês`
    })
    .join('\n\n')

  return [
    `📋 *NEXUS · Ações Pendentes*`,
    ``,
    lista,
    ``,
    `Responda *ok* para executar a #1, ou acesse o dashboard.`,
  ].join('\n')
}

export function buildHelpMessage(): string {
  return [
    `🤖 *NEXUS · Comandos disponíveis*`,
    ``,
    `*status* — ver ações pendentes`,
    `*ok* ou *sim* — executar a ação #1 pendente`,
    `*ajuda* — este menu`,
    ``,
    `Para detalhes completos, acesse o dashboard:`,
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://nexus.app',
  ].join('\n')
}

// ─── Legacy alias (mantém compatibilidade com executor.ts) ────

export const buildWhatsAppMessage = buildActionNotification
