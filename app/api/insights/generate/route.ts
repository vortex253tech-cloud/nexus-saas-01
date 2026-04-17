// POST /api/insights/generate
// Generates AI insights + alerts + diagnostic using Claude.
// Saves results to Supabase. Returns actions + alerts.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { generateAIAnalysis } from '@/lib/ai'
import type { DBFinancialData } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    company_id,
    perfil,
    setor,
    metaMensal,
    principalDesafio,
    nomeEmpresa,
    financialData,
  } = body as {
    company_id: string
    perfil: string
    setor: string
    metaMensal: number
    principalDesafio: string
    nomeEmpresa: string
    financialData: DBFinancialData[]
  }

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
    const result = await generateAIAnalysis({
      perfil: perfil ?? 'outro',
      setor: setor ?? 'Negócios',
      metaMensal: metaMensal ?? 50000,
      principalDesafio: principalDesafio ?? 'fluxo',
      nomeEmpresa: nomeEmpresa ?? 'Minha Empresa',
      financialData,
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
