// ─── Email Integration — Resend ────────────────────────────────
// Server-side only. Never import in client components.

import { Resend } from 'resend'

// Lazy — only instantiated when API key is present (avoids build-time crash)
let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

// Validate RESEND_FROM — must be "email@x.com" or "Name <email@x.com>"
function resolveFromAddress(): string {
  const raw = (process.env.RESEND_FROM ?? '').trim()
  if (!raw) return 'NEXUS <onboarding@resend.dev>'
  // Must contain @ and either be plain email or Name <email> format
  const isPlain  = /^[^\s]+@[^\s]+\.[^\s]+$/.test(raw)
  const isNamed  = /^.+<[^\s]+@[^\s]+\.[^\s]+>$/.test(raw)
  if (isPlain || isNamed) return raw
  // Bad format — try to salvage by wrapping with angle brackets
  const emailMatch = raw.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/)
  if (emailMatch) return `NEXUS <${emailMatch[1]}>`
  return 'NEXUS <onboarding@resend.dev>'
}

const FROM_ADDRESS = resolveFromAddress()

// ─── Types ─────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
  simulated?: boolean
}

// ─── HTML email builder ────────────────────────────────────────

export function buildActionEmailHTML(params: {
  nomeEmpresa: string
  actionTitulo: string
  actionDescricao: string
  actionDetalhe: string
  impactoEstimado: number
  passos?: string[]
}): string {
  const { nomeEmpresa, actionTitulo, actionDescricao, actionDetalhe, impactoEstimado, passos } = params
  const impactoFmt = `R$ ${Math.round(impactoEstimado).toLocaleString('pt-BR')}`

  const passosHTML = passos && passos.length > 0
    ? `<ol style="padding-left:20px;margin:8px 0 0;">
        ${passos.map(p => `<li style="margin-bottom:6px;color:#d1d5db;">${p}</li>`).join('')}
       </ol>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 32px 24px;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;font-weight:700;color:#fff;font-size:13px;letter-spacing:1px;">NEXUS</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;line-height:1.3;">Ação de alto impacto identificada</h1>
      <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:14px;">${nomeEmpresa}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <!-- Impact pill -->
      <div style="display:inline-block;background:#14532d;border:1px solid #166534;border-radius:999px;padding:6px 16px;margin-bottom:20px;">
        <span style="color:#4ade80;font-size:14px;font-weight:700;">💰 Impacto estimado: ${impactoFmt}/mês</span>
      </div>

      <!-- Action title -->
      <h2 style="color:#f4f4f5;margin:0 0 12px;font-size:18px;font-weight:700;">${actionTitulo}</h2>
      <p style="color:#a1a1aa;margin:0 0 20px;font-size:15px;line-height:1.6;">${actionDescricao}</p>

      <!-- Detail box -->
      <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Como executar</p>
        <p style="color:#d4d4d8;font-size:14px;line-height:1.7;margin:0;">${actionDetalhe}</p>
        ${passosHTML}
      </div>

      <!-- CTA -->
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nexus.app'}/dashboard"
         style="display:block;text-align:center;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;margin-bottom:24px;">
        Ver no dashboard →
      </a>

      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;">
        NEXUS · Inteligência financeira para empresas brasileiras<br>
        Você está recebendo porque esta ação foi executada automaticamente pelo sistema.
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── Recovery / carrinho email ─────────────────────────────────

export function buildRecoveryEmailHTML(params: {
  nomeEmpresa: string
  descricao: string
}): string {
  return buildActionEmailHTML({
    nomeEmpresa: params.nomeEmpresa,
    actionTitulo: 'Clientes precisam de atenção — oportunidade de recuperação',
    actionDescricao: params.descricao,
    actionDetalhe: 'O NEXUS identificou clientes que podem ser reativados. Entre em contato com eles agora para maximizar sua receita recorrente.',
    impactoEstimado: 0,
  })
}

// ─── Collection charge email ───────────────────────────────────

export function buildCollectionEmailHTML(params: {
  clientName: string
  valor: string
  dueDate: string | null
  nomeEmpresa: string
  daysOverdue: number
}): string {
  const { clientName, valor, dueDate, nomeEmpresa, daysOverdue } = params

  const urgencyColor = daysOverdue >= 7 ? '#ef4444' : daysOverdue >= 3 ? '#f59e0b' : '#a78bfa'
  const urgencyLabel =
    daysOverdue === 0 ? 'Vence hoje'
    : `Vencido há ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`

  const dueDateFmt = dueDate
    ? new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—'

  const bodyText =
    daysOverdue >= 7
      ? `Percebemos que o pagamento abaixo está pendente há <strong style="color:#ef4444;">${daysOverdue} dias</strong>. Pedimos que regularize com urgência para evitar cobranças adicionais.`
      : daysOverdue >= 3
      ? `Este é um lembrete de que identificamos um pagamento em aberto há ${daysOverdue} dias. Por favor, regularize o quanto antes.`
      : `Identificamos um pagamento pendente em seu cadastro. Caso já tenha realizado o pagamento, desconsidere este aviso.`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 32px 24px;">
      <span style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;font-weight:700;color:#fff;font-size:13px;letter-spacing:1px;">NEXUS</span>
      <h1 style="color:#fff;margin:16px 0 0;font-size:20px;font-weight:700;line-height:1.3;">Lembrete de pagamento pendente</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${nomeEmpresa}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">${clientName}</strong>,</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">${bodyText}</p>

      <div style="background:#09090b;border:1px solid ${urgencyColor}55;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Detalhes do pagamento</span>
          <span style="background:${urgencyColor}22;border:1px solid ${urgencyColor}55;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:${urgencyColor};">${urgencyLabel}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #27272a;">
              <span style="color:#71717a;font-size:13px;">💰 Valor devido</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #27272a;text-align:right;">
              <strong style="color:#fff;font-size:16px;">${valor}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <span style="color:#71717a;font-size:13px;">📅 Vencimento</span>
            </td>
            <td style="padding:10px 0;text-align:right;">
              <strong style="color:#d4d4d8;font-size:13px;">${dueDateFmt}</strong>
            </td>
          </tr>
        </table>
      </div>

      <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Pedimos que entre em contato conosco o quanto antes para regularizar sua situação.<br>
        Caso o pagamento já tenha sido realizado, por favor desconsidere este aviso.
      </p>

      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;border-top:1px solid #27272a;padding-top:20px;">
        Atenciosamente, <strong style="color:#71717a;">Equipe ${nomeEmpresa}</strong><br><br>
        NEXUS · Inteligência financeira para empresas brasileiras
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── Send email ────────────────────────────────────────────────

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const resend = getResend()
  if (!resend) {
    // No API key — simulate
    console.log(`[Email Simulation] To: ${params.to} | Subject: ${params.subject}`)
    return { success: true, simulated: true }
  }

  try {
    const data = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    })

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    return { success: true, id: data.data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown email error'
    return { success: false, error: msg }
  }
}

// ─── WhatsApp (stub — replace body with real provider when ready) ─────────────

export interface WhatsAppResult {
  success:    boolean
  id?:        string
  error?:     string
  simulated?: true
}

export async function sendWhatsApp(params: {
  to:   string  // E.164 format, e.g. +5511999999999
  body: string
}): Promise<WhatsAppResult> {
  // Placeholder: log and return simulated success
  // When integrating a provider (Twilio, Z-API, etc.), replace this block.
  console.log(`[whatsapp] stub → to=${params.to} | "${params.body.slice(0, 60)}${params.body.length > 60 ? '...' : ''}"`)
  return { success: true, simulated: true, id: `wa_stub_${Date.now()}` }
}
