import type { DecisionAction } from './segmentation'

export interface MessageVars {
  name:        string
  value:       string   // pre-formatted: "R$ 1.500,00"
  link:        string   // payment URL or empty string
  daysOverdue: number
}

// Dynamic templates with {{name}}, {{value}}, {{link}} substitution
const TEMPLATES: Record<DecisionAction, (v: MessageVars) => string> = {
  collect_payment: (v) =>
    `Olá ${v.name}, identificamos um pagamento pendente de R$ ${v.value}.` +
    (v.link ? ` Pague aqui: ${v.link}` : '') +
    ` Em caso de dúvidas, responda esta mensagem.`,

  reactivate_client: (v) =>
    `Olá ${v.name}! Sentimos sua falta. Preparamos uma oferta especial para você voltar. ` +
    `Responda esta mensagem e te contamos mais.`,

  upsell: (v) =>
    `Olá ${v.name}! Com base no seu histórico conosco, identificamos uma oportunidade ` +
    `exclusiva para potencializar seus resultados. Podemos conversar?`,
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function makeVars(
  client: { name: string; total_revenue: number; days_overdue?: number },
  paymentLink?: string,
): MessageVars {
  return {
    name:        client.name,
    value:       fmtBRL(client.total_revenue),
    link:        paymentLink ?? '',
    daysOverdue: client.days_overdue ?? 0,
  }
}

export function buildMessage(action: DecisionAction, vars: MessageVars): string {
  return TEMPLATES[action](vars)
}

export function emailSubject(action: DecisionAction, clientName: string): string {
  if (action === 'collect_payment')   return `Pagamento pendente — ${clientName}`
  if (action === 'reactivate_client') return `Sentimos sua falta, ${clientName}!`
  return `Uma oportunidade exclusiva para você, ${clientName}`
}
