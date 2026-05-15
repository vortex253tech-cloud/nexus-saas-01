// ---------------------------------------------------------------------------------
// NEXUS Waitlist Email Sequences
// Server-side only. All templates return full HTML strings.
// Sent via Resend (lib/email.ts pattern).
// ---------------------------------------------------------------------------------

import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.RESEND_FROM?.trim() || 'NEXUS <no-reply@nexusaas.com.br>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexusaas.com.br'

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NEXUS</title>
</head>
<body style="margin:0;padding:0;background:#04040a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#04040a;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#a855f7,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a855f7;">
            NEXUS
          </span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0d0d18;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:40px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:28px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
            NEXUS &mdash; Sistema Operacional Empresarial com IA<br/>
            <a href="${BASE_URL}/v1#waitlist" style="color:rgba(168,85,247,0.5);text-decoration:none;">Gerenciar preferências</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string, color = '#7c3aed'): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;letter-spacing:0.01em;">${text}</a>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;line-height:1.25;">${text}</h1>`
}

function p(text: string, muted = false): string {
  const color = muted ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)'
  return `<p style="margin:0 0 20px;font-size:15px;color:${color};line-height:1.65;">${text}</p>`
}

function divider(): string {
  return `<div style="height:1px;background:rgba(255,255,255,0.06);margin:28px 0;"></div>`
}

function badge(text: string): string {
  return `<span style="display:inline-block;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;font-size:11px;font-weight:600;padding:4px 12px;border-radius:999px;letter-spacing:0.05em;text-transform:uppercase;">${text}</span>`
}

function positionCard(position: number, referralUrl: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);border-radius:12px;margin:20px 0;">
    <tr><td style="padding:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.1em;">Sua posição</p>
      <p style="margin:0 0 16px;font-size:48px;font-weight:900;color:#a855f7;line-height:1;">#${position}</p>
      <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.35);">Indique amigos para subir mais rápido</p>
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;word-break:break-all;">
        <span style="font-size:12px;color:rgba(255,255,255,0.4);font-family:monospace;">${referralUrl}</span>
      </div>
    </td></tr>
  </table>`
}

function tierRow(emoji: string, count: string, reward: string, done = false): string {
  const color = done ? '#10b981' : 'rgba(255,255,255,0.35)'
  const bg    = done ? 'rgba(16,185,129,0.08)' : 'transparent'
  const border= done ? 'rgba(16,185,129,0.2)'  : 'rgba(255,255,255,0.06)'
  return `
  <tr>
    <td style="padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;margin-bottom:6px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:13px;color:${color};">${emoji} <strong>${count}</strong> indicação${count !== '1' ? 'ões' : ''} &rarr; ${reward}</td>
          ${done ? '<td align="right" style="font-size:12px;color:#10b981;">✓ Desbloqueado</td>' : ''}
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="height:6px;"></td></tr>`
}

// ─── Email 1: Boas-vindas + referral ─────────────────────────────────────────

export interface WelcomeEmailData {
  name: string
  email: string
  position: number
  referral_code: string
}

export function buildWelcomeEmail(data: WelcomeEmailData): string {
  const firstName   = data.name.split(' ')[0]
  const referralUrl = `${BASE_URL}/v1?ref=${data.referral_code}`

  return layout(`
    ${badge('Acesso garantido')}
    <div style="height:16px;"></div>
    ${h1(`${firstName}, você está na lista do NEXUS.`)}
    ${p(`Sua vaga no beta está reservada. Você é um dos primeiros a ter acesso ao Sistema Operacional Empresarial com IA.`)}

    ${positionCard(data.position, referralUrl)}

    ${divider()}

    <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.08em;">Como subir na fila:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 6px;">
      ${tierRow('⬆️', '1', 'Sobe 10 posições')}
      ${tierRow('🎯', '3', 'Beta garantido')}
      ${tierRow('⚡', '10', 'Acesso imediato')}
    </table>

    <div style="height:24px;"></div>
    <div style="text-align:center;">
      ${btn('Compartilhar meu link', referralUrl)}
    </div>

    ${divider()}
    ${p(`O NEXUS não é mais um software. É o sistema nervoso da sua empresa &mdash; lê dados, decide e executa ações sozinho.`, true)}
  `)
}

// ─── Email 2: Bastidores (D+2) ────────────────────────────────────────────────

export interface BastidoresEmailData {
  name: string
  email: string
  position: number
  referral_code: string
}

export function buildBastidoresEmail(data: BastidoresEmailData): string {
  const firstName   = data.name.split(' ')[0]
  const referralUrl = `${BASE_URL}/v1?ref=${data.referral_code}`

  return layout(`
    ${badge('Bastidores')}
    <div style="height:16px;"></div>
    ${h1(`${firstName}, isso é o que o NEXUS faz enquanto você dorme.`)}
    ${p(`Enquanto a maioria das ferramentas espera você clicar, o NEXUS age. Aqui está o que acontece numa empresa usando o sistema em modo autônomo:`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin:8px 0 24px;">
      <tr style="background:rgba(255,255,255,0.03);">
        <td style="padding:10px 16px;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Hora</td>
        <td style="padding:10px 16px;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Ação executada pela IA</td>
      </tr>
      ${[
        ['02:14', 'Cobrança enviada para 8 clientes inadimplentes'],
        ['07:30', 'Relatório executivo gerado e entregue ao CEO'],
        ['09:15', 'Campanha de reativação disparada — 312 contatos'],
        ['11:42', 'Alerta: margem bruta caiu 4% — causa identificada'],
        ['14:08', 'Follow-up automático para 17 leads quentes'],
        ['19:55', 'DRE do mês atualizada com análise de IA'],
      ].map(([hora, acao], i) => `
        <tr style="background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'};">
          <td style="padding:10px 16px;font-size:12px;color:rgba(124,58,237,0.8);font-family:monospace;white-space:nowrap;">${hora}</td>
          <td style="padding:10px 16px;font-size:13px;color:rgba(255,255,255,0.65);">${acao}</td>
        </tr>`).join('')}
    </table>

    ${p(`Nenhuma dessas ações precisou de intervenção humana. O NEXUS recebeu as regras uma vez e executou sozinho.`)}

    ${divider()}
    ${p(`Você está na posição <strong style="color:#a855f7;">#${data.position}</strong> da lista. Indique 3 pessoas e garanta seu acesso ao beta.`, true)}

    <div style="text-align:center;margin-top:20px;">
      ${btn('Indicar e subir na fila', referralUrl)}
    </div>
  `)
}

// ─── Email 3: Case study (D+5) ────────────────────────────────────────────────

export interface CaseStudyEmailData {
  name: string
  email: string
  referral_code: string
}

export function buildCaseStudyEmail(data: CaseStudyEmailData): string {
  const firstName   = data.name.split(' ')[0]
  const referralUrl = `${BASE_URL}/v1?ref=${data.referral_code}`

  return layout(`
    ${badge('Case de uso')}
    <div style="height:16px;"></div>
    ${h1(`"R$ 19.400 recuperados em 30 dias. Sem contratar ninguém."`)}
    ${p(`${firstName}, esse é o resultado de uma agência de marketing que entrou no beta fechado do NEXUS.`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.18);border-radius:12px;padding:0;margin:8px 0 24px;overflow:hidden;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">O problema</p>
        <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">22 clientes inadimplentes. R$ 19.400 parados. Equipe sem tempo para fazer follow-up manual em todos.</p>

        <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">O que o NEXUS fez</p>
        <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">Identificou os inadimplentes, criou mensagens personalizadas por perfil de cliente e disparou WhatsApp + email em sequência de 3 dias.</p>

        <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">O resultado</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:32px;"><p style="margin:0;font-size:32px;font-weight:900;color:#10b981;">R$ 19.4k</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">recuperados</p></td>
            <td style="padding-right:32px;"><p style="margin:0;font-size:32px;font-weight:900;color:#a855f7;">0h</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">de trabalho manual</p></td>
            <td><p style="margin:0;font-size:32px;font-weight:900;color:#06b6d4;">30 dias</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">para o resultado</p></td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${p(`Isso é só uma das automações. O mesmo sistema faz isso com campanhas, relatórios, follow-ups e diagnósticos financeiros.`)}

    ${divider()}
    <div style="text-align:center;">
      ${btn('Garantir meu acesso', referralUrl)}
    </div>
    ${p(`Indique 3 pessoas e entre no beta.`, true)}
  `)
}

// ─── Email 4: Urgência — vagas acabando (D+9) ─────────────────────────────────

export interface UrgencyEmailData {
  name: string
  email: string
  position: number
  referral_code: string
  remaining_spots?: number
}

export function buildUrgencyEmail(data: UrgencyEmailData): string {
  const firstName     = data.name.split(' ')[0]
  const referralUrl   = `${BASE_URL}/v1?ref=${data.referral_code}`
  const spots         = data.remaining_spots ?? 12

  return layout(`
    <p style="margin:0 0 16px;font-size:13px;color:#f59e0b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">⚠️ Vagas restantes: ${spots}</p>
    ${h1(`${firstName}, o beta está quase fechado.`)}
    ${p(`Restam <strong style="color:#f59e0b;">${spots} vagas</strong> no beta do NEXUS. Quando as vagas acabarem, a próxima abertura não tem data definida.`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:12px;margin:8px 0 24px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Você está na posição</p>
        <p style="margin:0 0 8px;font-size:42px;font-weight:900;color:#a855f7;line-height:1;">#${data.position}</p>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);">Indique 3 pessoas e entre agora.</p>
      </td></tr>
    </table>

    ${p(`O beta inclui acesso completo a todas as funcionalidades, suporte direto com o time fundador e preço especial de lançamento.`)}

    ${divider()}
    <div style="text-align:center;">
      ${btn('Indicar agora e entrar', referralUrl, '#d97706')}
    </div>
    <div style="height:12px;"></div>
    ${p(`Ou compartilhe: ${referralUrl}`, true)}
  `)
}

// ─── Email 5: Acesso liberado ─────────────────────────────────────────────────

export interface AccessEmailData {
  name: string
  email: string
  login_url?: string
}

export function buildAccessEmail(data: AccessEmailData): string {
  const firstName = data.name.split(' ')[0]
  const loginUrl  = data.login_url ?? `${BASE_URL}/login`

  return layout(`
    ${badge('🎉 Acesso liberado')}
    <div style="height:16px;"></div>
    ${h1(`${firstName}, seu acesso ao NEXUS está pronto.`)}
    ${p(`Você está entre os primeiros a ter acesso ao Sistema Operacional Empresarial com IA. Seu ambiente está configurado e pronto para uso.`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:12px;margin:8px 0 24px;overflow:hidden;">
      <tr><td style="padding:24px;">
        ${[
          ['01', 'Entre com seu email', 'O mesmo que você usou na waitlist'],
          ['02', 'Complete o onboarding', 'Leva menos de 5 minutos'],
          ['03', 'Crie seu primeiro flow', 'Veja a IA agir na sua empresa'],
        ].map(([n, title, desc]) => `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td style="width:36px;vertical-align:top;">
                <span style="display:inline-block;width:28px;height:28px;background:rgba(124,58,237,0.2);border-radius:8px;text-align:center;line-height:28px;font-size:12px;font-weight:700;color:#a855f7;">${n}</span>
              </td>
              <td style="padding-left:12px;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#fff;">${title}</p>
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">${desc}</p>
              </td>
            </tr>
          </table>`).join('')}
      </td></tr>
    </table>

    <div style="text-align:center;">
      ${btn('Acessar o NEXUS agora', loginUrl, '#059669')}
    </div>

    ${divider()}
    ${p(`Qualquer dúvida, responda este email diretamente. Estamos aqui para garantir que você tire o máximo do NEXUS.`, true)}
  `)
}

// ─── Email 6: Pós-onboarding — sistema configurado ───────────────────────────

export interface OnboardingWelcomeEmailData {
  name: string
  email: string
  empresa: string
}

export function buildOnboardingWelcomeEmail(data: OnboardingWelcomeEmailData): string {
  const firstName = data.name.split(' ')[0]
  const dashUrl   = `${BASE_URL}/dashboard`

  return layout(`
    ${badge('🚀 Sistema ativo')}
    <div style="height:16px;"></div>
    ${h1(`${firstName}, o NEXUS está operando na ${data.empresa}.`)}
    ${p(`Seu sistema está configurado e a IA já começou a monitorar sua operação. Aqui está o que está ativo agora:`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 8px;margin:4px 0 24px;">
      ${[
        ['🧠', 'IA Operacional', 'Análise contínua da sua operação em tempo real'],
        ['📊', 'Analytics', 'Dashboard com KPIs e insights automáticos'],
        ['🔔', 'Alertas Inteligentes', 'Notificações quando algo exigir sua atenção'],
        ['⚡', 'Automações', 'Fluxos prontos para ativar na sua empresa'],
      ].map(([emoji, title, desc]) => `
        <tr>
          <td style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:32px;font-size:18px;vertical-align:middle;">${emoji}</td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#fff;">${title}</p>
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">${desc}</p>
                </td>
                <td style="width:20px;text-align:right;vertical-align:middle;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px rgba(16,185,129,0.6);"></span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join('')}
    </table>

    ${p(`Primeiro passo recomendado: adicione seus dados financeiros na seção <strong style="color:#a855f7;">Dados</strong> para a IA começar a gerar insights personalizados.`)}

    <div style="text-align:center;margin-top:8px;">
      ${btn('Abrir meu sistema NEXUS', dashUrl)}
    </div>

    ${divider()}
    ${p(`Qualquer dúvida, responda este email diretamente. Queremos garantir que você tire o máximo do NEXUS.`, true)}
  `)
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

interface SendResult { success: boolean; id?: string; error?: string }

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: `${data.name.split(' ')[0]}, você está na lista — posição #${data.position}`,
    html:    buildWelcomeEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}

export async function sendBastidoresEmail(data: BastidoresEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: 'O que o NEXUS faz enquanto você dorme',
    html:    buildBastidoresEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}

export async function sendCaseStudyEmail(data: CaseStudyEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: '"R$ 19.400 recuperados em 30 dias. Sem contratar ninguém."',
    html:    buildCaseStudyEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}

export async function sendUrgencyEmail(data: UrgencyEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: `⚠️ Restam ${data.remaining_spots ?? 12} vagas no beta do NEXUS`,
    html:    buildUrgencyEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}

export async function sendAccessEmail(data: AccessEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: '🎉 Seu acesso ao NEXUS está pronto',
    html:    buildAccessEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}

export async function sendOnboardingWelcomeEmail(data: OnboardingWelcomeEmailData): Promise<SendResult> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'RESEND_API_KEY not set' }

  const firstName = data.name.split(' ')[0]
  const { data: sent, error } = await resend.emails.send({
    from:    FROM,
    to:      data.email,
    subject: `${firstName}, seu sistema NEXUS está operando`,
    html:    buildOnboardingWelcomeEmail(data),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, id: sent?.id }
}
