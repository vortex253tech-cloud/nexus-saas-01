// POST /api/insights/generate
// Generates AI insights + alerts + diagnostic using Claude.
// Saves results to Supabase. Returns actions + alerts.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { generateAIAnalysis } from '@/lib/ai'
import type { DBFinancialData } from '@/lib/db'
import type { PreviousInsight, PendingAction } from '@/lib/ai'
import { getNumber, getString, isRecord, readJsonObject } from '@/lib/unknown'
import { sendWhatsAppInsight } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  const company_id = body ? getString(body, 'company_id') : undefined
  const perfil = body ? getString(body, 'perfil') : undefined
  const setor = body ? getString(body, 'setor') : undefined
  const metaMensal = body ? getNumber(body, 'metaMensal') : undefined
  const principalDesafio = body ? getString(body, 'principalDesafio') : undefined
  const nomeEmpresa = body ? getString(body, 'nomeEmpresa') : undefined
  const financialData = body ? parseFinancialData(body.financialData) : []

  if (!company_id) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured', code: 'NO_API_KEY' },
      { status: 503 }
    )
  }

  const db = getSupabaseServerClient()

  try {
    // ─── Fetch memory: previous insights + pending actions ───────
    const previousInsights: PreviousInsight[] = []
    const pendingActions: PendingAction[] = []

    const [diagRes, actRes] = await Promise.all([
      db.from('diagnostics')
        .select('raw_data, created_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(2),
      db.from('actions')
        .select('titulo, status, prioridade, impacto_estimado')
        .eq('company_id', company_id)
        .neq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (diagRes.data) {
      for (const d of diagRes.data) {
        const raw = d.raw_data as { insights?: Array<{ titulo?: string; impacto_estimado?: number; categoria?: string }> } | null
        if (raw?.insights) {
          for (const ins of raw.insights.slice(0, 3)) {
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
      }
    }

    if (actRes.data) {
      for (const a of actRes.data) {
        pendingActions.push({
          titulo: a.titulo as string,
          status: a.status as string,
          prioridade: a.prioridade as string,
          impacto_estimado: a.impacto_estimado as number,
        })
      }
    }

    const result = await generateAIAnalysis({
      perfil: perfil ?? 'outro',
      setor: setor ?? 'Negócios',
      metaMensal: metaMensal ?? 50000,
      principalDesafio: principalDesafio ?? 'fluxo',
      nomeEmpresa: nomeEmpresa ?? 'Minha Empresa',
      financialData,
      previousInsights,
      pendingActions,
    })

    // Save diagnostic
    const { data: diagnostic, error: diagErr } = await db
      .from('diagnostics')
      .insert({
        company_id,
        score: result.score,
        resumo: result.resumo,
        ganho_total_estimado: result.ganho_total_estimado,
        benchmark_label: result.benchmark_label,
        ai_summary: result.ai_summary,
        raw_data: result,
      })
      .select()
      .single()

    if (diagErr) {
      console.error('Diagnostic save error:', diagErr)
    }

    // Delete old pending actions and save new ones
    await db.from('actions').delete().eq('company_id', company_id).eq('status', 'pending')

    const actionsToInsert = result.insights.map(insight => ({
      company_id,
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
    }))

    const { data: actions, error: actErr } = await db
      .from('actions')
      .insert(actionsToInsert)
      .select()

    if (actErr) console.error('Actions save error:', actErr)

    // Delete old unread alerts and save new ones
    await db.from('alerts').delete().eq('company_id', company_id).eq('lido', false)

    const alertsToInsert = result.alerts.map(a => ({
      company_id,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao,
      impacto: a.impacto,
      source: 'ai' as const,
    }))

    const { data: alerts, error: alertErr } = await db
      .from('alerts')
      .insert(alertsToInsert)
      .select()

    if (alertErr) console.error('Alerts save error:', alertErr)

    // ─── Fire-and-forget: WhatsApp insight notification ──────────
    void (async () => {
      try {
        const { data: company } = await db
          .from('companies')
          .select('user_id')
          .eq('id', company_id)
          .single()

        if (!company?.user_id) return

        const { data: user } = await db
          .from('users')
          .select('phone')
          .eq('id', company.user_id)
          .single()

        const phone = (user as { phone?: string | null } | null)?.phone
        if (!phone || !result.insights.length) return

        const top = result.insights[0]
        const valor = `R$ ${Math.round(top.impacto_estimado).toLocaleString('pt-BR')}`
        const msg = `💡 *NEXUS CFO*\n${top.titulo}\n${top.descricao}\n💰 ${valor}/mês`
        const waResult = await sendWhatsAppInsight(phone, msg)
        console.log('[insights] WhatsApp sent:', waResult)
      } catch (err) {
        console.error('[insights] WhatsApp notification failed:', err)
      }
    })()

    return NextResponse.json({
      diagnostic,
      actions: actions ?? [],
      alerts: alerts ?? [],
      summary: result.ai_summary,
    })
  } catch (err) {
    console.error('AI generation error:', err)
    return NextResponse.json(
      { error: 'AI generation failed', detail: String(err) },
      { status: 500 }
    )
  }
}

function parseFinancialData(value: unknown): DBFinancialData[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    const id = getString(item, 'id')
    const company_id = getString(item, 'company_id')
    const revenue = getNumber(item, 'revenue')
    const costs = getNumber(item, 'costs')
    const profit = getNumber(item, 'profit')
    const period_label = getString(item, 'period_label')
    const period_date = getString(item, 'period_date')
    const created_at = getString(item, 'created_at')
    const rawNote = item.note

    if (!id || !company_id || revenue === undefined || costs === undefined || profit === undefined || !period_label || !period_date || !created_at) {
      return []
    }

    return [{
      id,
      company_id,
      revenue,
      costs,
      profit,
      period_label,
      period_date,
      note: typeof rawNote === 'string' ? rawNote : null,
      created_at,
    }]
  })
}
