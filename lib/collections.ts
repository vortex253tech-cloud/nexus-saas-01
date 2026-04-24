// ─── Collection System — Email automation + WhatsApp deeplink ────────────────
// Server-side only.

import { sendEmail, buildCollectionEmailHTML } from './email'
import { getSupabaseServerClient } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionClient {
  id: string
  name: string
  phone: string | null
  email: string | null
  total_revenue: number
  due_date: string | null
  status: string
}

export interface CollectionCompany {
  id: string
  nome: string
}

export interface CollectionResult {
  clientId: string
  clientName: string
  success: boolean
  message: string
  method: 'email' | 'none'
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDaysOverdue(dueDate: string): number {
  const due   = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000))
}

export function computeEffectiveStatus(
  status: string,
  dueDate: string | null,
): 'pending' | 'paid' | 'overdue' {
  if (status === 'paid') return 'paid'
  if (dueDate) {
    const due   = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (today > due) return 'overdue'
  }
  return 'pending'
}

// ─── WhatsApp deeplink (no API call — user triggers manually) ─────────────────

export function generateChargeMessage(client: CollectionClient): string {
  const valor   = `R$ ${client.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const dueDate = client.due_date ?? 'data indefinida'
  return (
    `Olá ${client.name}, tudo bem?\n\n` +
    `Identificamos um pagamento pendente de ${valor} com vencimento em ${dueDate}.\n\n` +
    `Pode verificar para mim?`
  )
}

export function generateWhatsAppLink(client: CollectionClient): string {
  if (!client.phone) return ''
  const phone   = client.phone.replace(/[^\d]/g, '')
  const message = encodeURIComponent(generateChargeMessage(client))
  return `https://wa.me/${phone}?text=${message}`
}

// ─── Charge a single client via Email ─────────────────────────────────────────

export async function chargeClientByEmail(
  client: CollectionClient,
  company: CollectionCompany,
): Promise<CollectionResult> {
  const db          = getSupabaseServerClient()
  const daysOverdue = client.due_date ? getDaysOverdue(client.due_date) : 0
  const valor       = `R$ ${client.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  if (!client.email) {
    return {
      clientId:   client.id,
      clientName: client.name,
      success:    false,
      message:    '',
      method:     'none',
      error:      'Cliente sem email cadastrado',
    }
  }

  const subject =
    daysOverdue >= 7
      ? `Urgente: pagamento vencido há ${daysOverdue} dias — ${company.nome}`
      : daysOverdue >= 3
      ? `Atenção: pagamento pendente — ${company.nome}`
      : `Lembrete de pagamento pendente — ${company.nome}`

  const html = buildCollectionEmailHTML({
    clientName:  client.name,
    valor,
    dueDate:     client.due_date,
    nomeEmpresa: company.nome,
    daysOverdue,
  })

  const emailResult = await sendEmail({ to: client.email, subject, html })

  void db.from('collection_logs').insert({
    client_id:  client.id,
    company_id: company.id,
    message:    subject,
    status:     emailResult.success ? 'sent' : 'failed',
    method:     'email',
    amount_due: client.total_revenue,
  })

  if (client.status !== 'overdue' && client.status !== 'paid') {
    void db.from('clients').update({ status: 'overdue' }).eq('id', client.id)
  }

  return {
    clientId:   client.id,
    clientName: client.name,
    success:    emailResult.success,
    message:    subject,
    method:     'email',
    error:      emailResult.error,
  }
}

// ─── Bulk: charge all overdue clients via Email for a company ─────────────────

export async function runEmailCollections(companyId: string): Promise<{
  charged: number
  failed: number
  results: CollectionResult[]
}> {
  const db    = getSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  // Auto-promote pending → overdue where past due
  await db
    .from('clients')
    .update({ status: 'overdue' })
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .lt('due_date', today)

  const { data: overdueClients } = await db
    .from('clients')
    .select('id, name, phone, email, total_revenue, due_date, status')
    .eq('company_id', companyId)
    .eq('status', 'overdue')
    .not('email', 'is', null)

  if (!overdueClients || overdueClients.length === 0) {
    return { charged: 0, failed: 0, results: [] }
  }

  const { data: company } = await db
    .from('companies')
    .select('id, nome')
    .eq('id', companyId)
    .single()

  const companyInfo: CollectionCompany = {
    id:   companyId,
    nome: (company as { nome?: string } | null)?.nome ?? 'Empresa',
  }

  const results: CollectionResult[] = []
  for (const client of overdueClients) {
    const result = await chargeClientByEmail(client as CollectionClient, companyInfo)
    results.push(result)
  }

  return {
    charged: results.filter(r => r.success).length,
    failed:  results.filter(r => !r.success).length,
    results,
  }
}
