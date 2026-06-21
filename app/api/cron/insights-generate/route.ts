// GET|POST /api/cron/insights-generate — daily Claude-powered insights/alerts
//
// /api/insights/generate already does this (the Advisor page calls it
// on-demand), but nothing ever triggered it automatically — the only
// "proactive" engine running on a schedule was the rule-based
// decision-engine/autopilot (see /api/cron/ai-runner). This cron makes the
// Claude-based narrative layer (insights, alerts, the top-insight WhatsApp
// ping) run daily too, for every paying/trialing company, without anyone
// having to open the dashboard.
//
// Reads company profile fields straight from the DB (not from a client
// body, since there's no client here) — companies.name/sector/perfil/
// principal_desafio/meta_mensal, same columns /api/insights/generate
// trusts from the request body today.
//
// Protected by CRON_SECRET header (same convention as every other cron route).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { generateAIAnalysis } from '@/lib/ai'
import type { DBFinancialData } from '@/lib/db'
import type { PreviousInsight, PendingAction } from '@/lib/ai'
import { sendWhatsAppInsight } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const MIN_HOURS_BETWEEN_RUNS = 20

interface CompanyRow {
  id: string
  name: string | null
  sector: string | null
  perfil: string | null
  principal_desafio: string | null
  meta_mensal: number | null
  user_id: string
}

async function handler(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ ok: true, processed: 0, message: 'ANTHROPIC_API_KEY not configured' })
  }

  const db = getSupabaseServerClient()

  // Only companies belonging to an active or trialing subscription, and
  // that have at least one financial_data row — otherwise Claude has
  // nothing real to analyze and would just hallucinate numbers.
  // Two simple queries + an intersection in JS, instead of a nested
  // PostgREST embedded filter — easier to reason about and debug.
  const [{ data: companies, error: cErr }, { data: activeSubs }] = await Promise.all([
    db.from('companies')
      .select('id, name, sector, perfil, principal_desafio, meta_mensal, user_id')
      .returns<CompanyRow[]>(),
    db.from('subscriptions')
      .select('user_id')
      .in('status', ['trialing', 'active']),
  ])

  if (cErr || !companies || companies.length === 0) {
    return NextResponse.json({
      ok: true, processed: 0,
      message: cErr ? cErr.message : 'No companies found',
    })
  }

  const activeUserIds = new Set((activeSubs ?? []).map(s => s.user_id as string))
  const eligibleCompanies = companies.filter(c => activeUserIds.has(c.user_id))

  if (eligibleCompanies.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No active/trialing companies' })
  }

  const results: Array<{ company_id: string; ran: boolean; reason?: string; error?: string }> = []

  for (const company of eligibleCompanies) {
    try {
      // Skip if a financial_data row doesn't exist — nothing real to analyze.
      const { count: fdCount } = await db
        .from('financial_data')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)

      if (!fdCount) {
        results.push({ company_id: company.id, ran: false, reason: 'no financial_data' })
        continue
      }

      // Skip if we already ran recently — keeps this idempotent if the
      // cron fires more than once, and caps Claude spend to ~daily/company.
      const since = new Date(Date.now() - MIN_HOURS_BETWEEN_RUNS * 60 * 60 * 1000).toISOString()
      const { count: recentCount } = await db
        .from('diagnostics')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('created_at', since)

      if (recentCount) {
        results.push({ company_id: company.id, ran: false, reason: 'ran recently' })
        continue
      }

      await runInsightsForCompany(db, company)
      results.push({ company_id: company.id, ran: true })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`[insights-generate cron] company ${company.id} failed:`, err)
      results.push({ company_id: company.id, ran: false, error })
    }
  }

  return NextResponse.json({ ok: true, processed: results.filter(r => r.ran).length, results })
}

async function runInsightsForCompany(
  db: ReturnType<typeof getSupabaseServerClient>,
  company: CompanyRow,
) {
  const [diagRes, actRes, fdRes] = await Promise.all([
    db.from('diagnostics')
      .select('raw_data, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(2),
    db.from('actions')
      .select('titulo, status, prioridade, impacto_estimado')
      .eq('company_id', company.id)
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('financial_data')
      .select('id, company_id, revenue, costs, profit, period_label, period_date, note, created_at')
      .eq('company_id', company.id)
      .order('period_date', { ascending: false })
      .limit(12)
      .returns<DBFinancialData[]>(),
  ])

  const previousInsights: PreviousInsight[] = []
  for (const d of diagRes.data ?? []) {
    const raw = d.raw_data as { insights?: Array<{ titulo?: string; impacto_estimado?: number; categoria?: string }> } | null
    for (const ins of raw?.insights?.slice(0, 3) ?? []) {
      if (ins.titulo) {
        previousInsights.push({
          titulo: ins.titulo,
          impacto_estimado: ins.impacto_estimado ?? 0,
          categoria: ins.categoria ?? 'operacional',
          created_at: d.created_at as string,
        })
      }
    }
  }

  const pendingActions: PendingAction[] = (actRes.data ?? []).map(a => ({
    titulo: a.titulo as string,
    status: a.status as string,
    prioridade: a.prioridade as string,
    impacto_estimado: a.impacto_estimado as number,
  }))

  const result = await generateAIAnalysis({
    perfil: company.perfil ?? 'outro',
    setor: company.sector ?? 'Negócios',
    metaMensal: company.meta_mensal ?? 50000,
    principalDesafio: company.principal_desafio ?? 'fluxo',
    nomeEmpresa: company.name ?? 'Minha Empresa',
    financialData: fdRes.data ?? [],
    previousInsights,
    pendingActions,
  })

  const { data: diagnostic } = await db
    .from('diagnostics')
    .insert({
      company_id: company.id,
      score: result.score,
      resumo: result.resumo,
      ganho_total_estimado: result.ganho_total_estimado,
      benchmark_label: result.benchmark_label,
      ai_summary: result.ai_summary,
      raw_data: result,
    })
    .select()
    .single()

  await db.from('actions').delete().eq('company_id', company.id).eq('status', 'pending')

  await db.from('actions').insert(result.insights.map(insight => ({
    company_id: company.id,
    diagnostic_id: diagnostic?.id ?? null,
    titulo: insight.titulo,
    descricao: insight.descricao,
    detalhe: insight.detalhe,
    impacto_estimado: insight.impacto_estimado,
    prazo: insight.prazo,
    prioridade: insight.prioridade,
    categoria: insight.categoria,
    icone: insight.icone,
    passos: insight.passos,
    status: 'pending' as const,
    source: 'ai' as const,
    effort_level: insight.effort_level ?? 'medium',
    auto_executable: insight.auto_executable ?? false,
    execution_type: insight.execution_type ?? 'recommendation',
    urgencia: insight.urgencia ?? 'media',
    impacto_anual: insight.impacto_anual ?? (insight.impacto_estimado * 12),
    message_email: insight.message_email ?? null,
    message_whatsapp: insight.message_whatsapp ?? null,
  })))

  await db.from('alerts').delete().eq('company_id', company.id).eq('lido', false)

  await db.from('alerts').insert(result.alerts.map(a => ({
    company_id: company.id,
    tipo: a.tipo,
    titulo: a.titulo,
    descricao: a.descricao,
    impacto: a.impacto,
    source: 'ai' as const,
  })))

  // Fire-and-forget WhatsApp ping with the top insight, same as the
  // on-demand route — this is the part that actually makes it feel
  // proactive: the owner finds out without opening the dashboard.
  void (async () => {
    try {
      const { data: userRow } = await db
        .from('users')
        .select('phone')
        .eq('id', company.user_id)
        .single()

      const phone = (userRow as { phone?: string | null } | null)?.phone
      if (!phone || !result.insights.length) return

      const top = result.insights[0]
      const valor = `R$ ${Math.round(top.impacto_estimado).toLocaleString('pt-BR')}`
      await sendWhatsAppInsight(phone, `💡 *NEXUS CFO*\n${top.titulo}\n${top.descricao}\n💰 ${valor}/mês`)
    } catch (err) {
      console.error('[insights-generate cron] WhatsApp notification failed:', err)
    }
  })()
}

export const GET  = handler
export const POST = handler
