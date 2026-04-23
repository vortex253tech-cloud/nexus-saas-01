// ─── Collection System — AI-generated messages + WhatsApp ────────────────────
// Server-side only.

import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsApp } from './whatsapp'
import { getSupabaseServerClient } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionClient {
  id: string
  name: string
  phone: string | null
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

// ─── AI: generate collection message ─────────────────────────────────────────

export async function generateCollectionMessage(
  client: CollectionClient,
  company: CollectionCompany,
  daysOverdue: number,
): Promise<string> {
  const valor = `R$${client.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content:
          `Você é um especialista em cobrança amigável.\n` +
          `Gere uma mensagem curta, profissional e educada para cobrar um cliente via WhatsApp.\n\n` +
          `Cliente: ${client.name}\n` +
          `Valor devido: ${valor}\n` +
          `Dias em atraso: ${daysOverdue}\n` +
          `Empresa: ${company.nome}\n\n` +
          `Requisitos:\n` +
          `- Amigável e empático, nunca agressivo\n` +
          `- Direto ao ponto, máximo 3 frases\n` +
          `- CTA claro: entrar em contato ou regularizar\n` +
          `- Texto simples, sem markdown, sem asteriscos\n` +
          `- Mencionar o nome, o valor e os dias em atraso\n\n` +
          `Retorne APENAS a mensagem, sem explicações.`,
      }],
    })

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : fallbackMessage(client.name, valor, daysOverdue)
  } catch {
    return fallbackMessage(client.name, valor, daysOverdue)
  }
}

function fallbackMessage(name: string, valor: string, days: number): string {
  return (
    `Olá ${name}, temos um valor pendente de ${valor} vencido há ${days} dia${days !== 1 ? 's' : ''}. ` +
    `Podemos te ajudar a regularizar? Entre em contato conosco.`
  )
}

// ─── Charge a single client ───────────────────────────────────────────────────

export async function chargeClient(
  client: CollectionClient,
  company: CollectionCompany,
): Promise<CollectionResult> {
  const db         = getSupabaseServerClient()
  const daysOverdue = client.due_date ? getDaysOverdue(client.due_date) : 0

  let message = ''
  let success = false
  let errorMsg: string | undefined

  try {
    message = await generateCollectionMessage(client, company, daysOverdue)

    if (client.phone) {
      const result = await sendWhatsApp({ phone: client.phone, message })
      success  = result.success
      errorMsg = result.error
    } else {
      // No phone — log anyway (message generated but not sent)
      success = true
      errorMsg = 'no_phone'
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    success  = false
  }

  // Log the attempt (fire-and-forget, don't block result)
  void db.from('collection_logs').insert({
    client_id:  client.id,
    company_id: company.id,
    message,
    status:     success ? 'sent' : 'failed',
    amount_due: client.total_revenue,
  })

  // Update client status to 'overdue' if not already
  if (client.status !== 'overdue' && client.status !== 'paid') {
    void db.from('clients').update({ status: 'overdue' }).eq('id', client.id)
  }

  return {
    clientId:   client.id,
    clientName: client.name,
    success,
    message,
    error: errorMsg,
  }
}

// ─── Bulk: charge all overdue clients for a company ──────────────────────────

export async function runCollections(companyId: string): Promise<{
  charged: number
  failed: number
  results: CollectionResult[]
}> {
  const db = getSupabaseServerClient()

  // 1. Auto-update statuses: pending → overdue where today > due_date
  const today = new Date().toISOString().slice(0, 10)
  await db
    .from('clients')
    .update({ status: 'overdue' })
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .lt('due_date', today)

  // 2. Fetch overdue clients
  const { data: overdueClients } = await db
    .from('clients')
    .select('id, name, phone, total_revenue, due_date, status')
    .eq('company_id', companyId)
    .eq('status', 'overdue')

  if (!overdueClients || overdueClients.length === 0) {
    return { charged: 0, failed: 0, results: [] }
  }

  // 3. Fetch company name
  const { data: company } = await db
    .from('companies')
    .select('id, nome')
    .eq('id', companyId)
    .single()

  const companyInfo: CollectionCompany = {
    id:   companyId,
    nome: (company as { nome?: string } | null)?.nome ?? 'Empresa',
  }

  // 4. Charge each client sequentially to avoid rate limits
  const results: CollectionResult[] = []
  for (const client of overdueClients) {
    const result = await chargeClient(client as CollectionClient, companyInfo)
    results.push(result)
  }

  const charged = results.filter(r => r.success).length
  const failed  = results.filter(r => !r.success).length

  return { charged, failed, results }
}
