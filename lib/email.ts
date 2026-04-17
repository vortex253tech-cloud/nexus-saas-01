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

const FROM_ADDRESS = process.env.RESEND_FROM ?? 'NEXUS <onboarding@resend.dev>'

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
