// ─── Action Engine — Rule-Based (no AI dependency) ───────────────────────────
// Generates priority actions from real client data.
// Runs fast, works even without ANTHROPIC_API_KEY.

import { getSupabaseServerClient } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngineAction {
  titulo:           string
  descricao:        string
  detalhe:          string
  impacto_estimado: number
  prioridade:       'critica' | 'alta' | 'media'
  urgencia:         'alta' | 'media' | 'baixa'
  icone:            string
  execution_type:   'email' | 'whatsapp' | 'recommendation' | 'analytics'
  auto_executable:  boolean
  effort_level:     'low' | 'medium' | 'high'
  passos:           string[]
  message_email?:   string | null
}

export interface ClientScore {
  clientId:   string
  clientName: string
  valor:      number
  risk:       'high' | 'medium' | 'low'
  score:      number  // 0-100 (higher = more at risk)
  reasons:    string[]
}

interface ClientRow {
  id:            string
  name:          string
  email:         string | null
  total_revenue: number
  due_date:      string | null
  status:        string
  created_at:    string
}

// ─── Client scoring ───────────────────────────────────────────────────────────

export function scoreClient(client: ClientRow): ClientScore {
  let score = 0
  const reasons: string[] = []

  const daysOverdue = client.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(client.due_date).getTime()) / 86_400_000))
    : 0

  // Status
  if (client.status === 'overdue') {
    score += 40
    reasons.push('Em atraso')
  } else if (client.status === 'pending') {
    score += 15
    reasons.push('Pagamento pendente')
  }

  // Days overdue
  if (daysOverdue >= 30) { score += 30; reasons.push(`${daysOverdue} dias de atraso`) }
  else if (daysOverdue >= 14) { score += 20; reasons.push(`${daysOverdue} dias de atraso`) }
  else if (daysOverdue >= 7)  { score += 10; reasons.push(`${daysOverdue} dias de atraso`) }
  else if (daysOverdue >= 1)  { score += 5 }

  // High value
  if (client.total_revenue >= 50_000) { score += 20; reasons.push('Alto valor') }
  else if (client.total_revenue >= 10_000) { score += 10 }

  // New client (< 30 days) with pending payment
  const daysSinceCreation = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86_400_000)
  if (daysSinceCreation < 30 && client.status !== 'paid') {
    score += 5
    reasons.push('Cliente novo')
  }

  const risk: ClientScore['risk'] =
    score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'

  return {
    clientId:   client.id,
    clientName: client.name,
    valor:      client.total_revenue,
    risk,
    score:      Math.min(100, score),
    reasons,
  }
}

// ─── Action generators ────────────────────────────────────────────────────────

function actionForOverdueClients(overdueClients: ClientRow[], totalOverdue: number): EngineAction | null {
  if (overdueClients.length === 0) return null

  const urgent   = overdueClients.filter(c => {
    const d = c.due_date ? Math.floor((Date.now() - new Date(c.due_date).getTime()) / 86_400_000) : 0
    return d >= 7
  })
  const hasUrgent = urgent.length > 0

  return {
    titulo:           `Cobrar ${overdueClients.length} cliente${overdueClients.length > 1 ? 's' : ''} inadimplente${overdueClients.length > 1 ? 's' : ''}`,
    descricao:        `${overdueClients.length} clientes com pagamentos em atraso totalizando R$ ${Math.round(totalOverdue).toLocaleString('pt-BR')}. ${hasUrgent ? `${urgent.length} com mais de 7 dias de atraso.` : ''}`,
    detalhe:          'Envie lembretes de cobrança por e-mail para todos os clientes inadimplentes de forma automática. O sistema personaliza cada mensagem com o nome do cliente e o valor devido.',
    impacto_estimado: totalOverdue,
    prioridade:       hasUrgent ? 'critica' : 'alta',
    urgencia:         hasUrgent ? 'alta' : 'media',
    icone:            '💸',
    execution_type:   'email',
    auto_executable:  true,
    effort_level:     'low',
    passos: [
      'Clique em Executar para disparar os e-mails de cobrança',
      `${overdueClients.length} e-mails serão enviados automaticamente`,
      'Acompanhe os resultados no histórico de execução',
    ],
  }
}

function actionForHighValuePending(clients: ClientRow[]): EngineAction | null {
  const highValue = clients.filter(c =>
    c.status !== 'paid' && c.total_revenue >= 10_000
  )
  if (highValue.length === 0) return null

  const total = highValue.reduce((s, c) => s + c.total_revenue, 0)

  return {
    titulo:           `Priorizar ${highValue.length} cliente${highValue.length > 1 ? 's' : ''} de alto valor`,
    descricao:        `${highValue.length} clientes com contratos acima de R$ 10k totalizando R$ ${Math.round(total).toLocaleString('pt-BR')} pendentes. Prioridade máxima.`,
    detalhe:          'Clientes de alto valor merecem contato personalizado. Revise cada caso e prepare uma abordagem diferenciada para recuperar estes pagamentos.',
    impacto_estimado: total,
    prioridade:       'alta',
    urgencia:         'alta',
    icone:            '👑',
    execution_type:   'recommendation',
    auto_executable:  false,
    effort_level:     'medium',
    passos: [
      'Acesse a aba Clientes e filtre por status pendente',
      'Entre em contato individualmente com cada cliente de alto valor',
      'Ofereça condições de parcelamento se necessário',
    ],
  }
}

function actionForEmailSetup(hasPendingWithEmail: boolean, emailsMissing: number): EngineAction | null {
  if (emailsMissing === 0) return null
  return {
    titulo:           `Cadastrar e-mail de ${emailsMissing} cliente${emailsMissing > 1 ? 's' : ''}`,
    descricao:        `${emailsMissing} cliente${emailsMissing > 1 ? 's' : ''} sem e-mail cadastrado — impossível enviar cobrança automática.`,
    detalhe:          'Sem e-mail, o sistema não consegue enviar cobranças automáticas. Cadastre o e-mail de cada cliente para ativar o modo autopilot.',
    impacto_estimado: 0,
    prioridade:       'media',
    urgencia:         'media',
    icone:            '📧',
    execution_type:   'recommendation',
    auto_executable:  false,
    effort_level:     'low',
    passos: [
      'Vá para a aba Clientes',
      'Edite cada cliente sem e-mail e preencha o campo',
      'O sistema ativará cobrança automática assim que o e-mail for cadastrado',
    ],
  }
}

function actionForRecoveryRate(
  overdueCount: number,
  totalClients: number,
  totalOverdue: number
): EngineAction | null {
  if (overdueCount === 0 || totalClients === 0) return null
  const rate = (overdueCount / totalClients) * 100
  if (rate < 20) return null

  return {
    titulo:           `Taxa de inadimplência em ${Math.round(rate)}% — ativar régua de cobrança`,
    descricao:        `${Math.round(rate)}% dos clientes com pagamentos em atraso. Acima de 15% indica necessidade de política de cobrança estruturada.`,
    detalhe:          'Com mais de 20% de inadimplência, é essencial ter uma régua de cobrança automática. Ative o auto-pilot para enviar lembretes nos dias D+1, D+3 e D+7 automaticamente.',
    impacto_estimado: totalOverdue * 0.3,
    prioridade:       rate >= 30 ? 'critica' : 'alta',
    urgencia:         'alta',
    icone:            '📊',
    execution_type:   'analytics',
    auto_executable:  false,
    effort_level:     'low',
    passos: [
      'Ative o Auto-Pilot no menu de configurações',
      'O sistema vai disparar e-mails de cobrança automaticamente',
      'Monitore a taxa de recuperação no dashboard a cada semana',
    ],
  }
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function generateActions(companyId: string): Promise<{
  actions:      EngineAction[]
  scores:       ClientScore[]
  totalOverdue: number
  overdueCount: number
  inserted:     number
}> {
  const db = getSupabaseServerClient()

  const { data: clients } = await db
    .from('clients')
    .select('id, name, email, total_revenue, due_date, status, created_at')
    .eq('company_id', companyId)
    .returns<ClientRow[]>()

  const all = clients ?? []

  const overdue      = all.filter(c => c.status === 'overdue')
  const totalOverdue = overdue.reduce((s, c) => s + (c.total_revenue ?? 0), 0)
  const withoutEmail = all.filter(c => c.status !== 'paid' && !c.email)
  const scores       = all.map(scoreClient).sort((a, b) => b.score - a.score)

  // Generate candidate actions
  const candidates: (EngineAction | null)[] = [
    actionForOverdueClients(overdue, totalOverdue),
    actionForHighValuePending(all),
    actionForRecoveryRate(overdue.length, all.length, totalOverdue),
    actionForEmailSetup(false, withoutEmail.length),
  ]

  const actions = candidates.filter((a): a is EngineAction => a !== null)

  // Persist to DB (skip duplicates by checking existing pending titles)
  const { data: existing } = await db
    .from('actions')
    .select('titulo')
    .eq('company_id', companyId)
    .eq('status', 'pending')

  const existingTitles = new Set((existing ?? []).map(r => r.titulo as string))

  let inserted = 0
  for (const action of actions) {
    if (existingTitles.has(action.titulo)) continue
    const { error } = await db.from('actions').insert({
      company_id:       companyId,
      titulo:           action.titulo,
      descricao:        action.descricao,
      detalhe:          action.detalhe,
      impacto_estimado: action.impacto_estimado,
      prioridade:       action.prioridade,
      urgencia:         action.urgencia,
      icone:            action.icone,
      execution_type:   action.execution_type,
      auto_executable:  action.auto_executable,
      effort_level:     action.effort_level,
      passos:           action.passos,
      message_email:    action.message_email ?? null,
      status:           'pending',
      ganho_realizado:  0,
    })
    if (!error) inserted++
  }

  return { actions, scores, totalOverdue, overdueCount: overdue.length, inserted }
}
