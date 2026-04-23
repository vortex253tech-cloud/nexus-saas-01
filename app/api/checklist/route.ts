// GET /api/checklist?company_id=... — items + progress
// POST /api/checklist               — mark item complete/incomplete

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'

// ─── Static checklist items definition ────────────────────────────

export interface ChecklistItem {
  id: string
  label: string
  description: string
  category: string
  action: 'analyze' | 'export' | 'navigate' | 'ai' | 'manual'
  href?: string
  requiresPlan?: 'starter' | 'pro'
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'lancar_dados',
    label: 'Lançar dados financeiros',
    description: 'Insira receita, custos e lucro do período mais recente',
    category: 'financeiro',
    action: 'navigate',
    href: '/dashboard/financeiro',
  },
  {
    id: 'ai_diagnostico',
    label: 'Gerar diagnóstico com IA',
    description: 'Análise completa com insights e oportunidades identificadas',
    category: 'ia',
    action: 'ai',
  },
  {
    id: 'executar_acao',
    label: 'Executar ação prioritária',
    description: 'Implementar a recomendação de maior impacto da IA',
    category: 'ia',
    action: 'navigate',
    href: '/dashboard/actions',
  },
  {
    id: 'top20',
    label: 'Identificar top 20% de clientes',
    description: 'Calcular quais clientes geram 80% da sua receita',
    category: 'clientes',
    action: 'analyze',
    href: '/dashboard/clients',
  },
  {
    id: 'export_clients',
    label: 'Exportar relatório de faturamento',
    description: 'Gerar CSV com ranking completo de clientes por receita',
    category: 'clientes',
    action: 'export',
    requiresPlan: 'pro',
  },
  {
    id: 'map_origem',
    label: 'Mapear origem dos clientes',
    description: 'Registrar de onde vieram seus principais clientes (CRM simples)',
    category: 'clientes',
    action: 'navigate',
    href: '/dashboard/clients',
  },
  {
    id: 'configurar_alertas',
    label: 'Revisar alertas ativos',
    description: 'Monitorar avisos críticos e oportunidades detectadas',
    category: 'monitoramento',
    action: 'navigate',
    href: '/dashboard/alerts',
  },
  {
    id: 'revisar_historico',
    label: 'Revisar histórico de execuções',
    description: 'Acompanhar ganhos realizados pelas ações executadas',
    category: 'historico',
    action: 'navigate',
    href: '/dashboard/history',
  },
]

// ─── GET handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data: progress } = await db
    .from('checklist_progress')
    .select('action_id, completed, completed_at')
    .eq('company_id', company_id)

  const progressMap = new Map(
    (progress ?? []).map(p => [p.action_id as string, { completed: p.completed as boolean, completed_at: p.completed_at as string | null }])
  )

  const items = CHECKLIST_ITEMS.map(item => ({
    ...item,
    completed: progressMap.get(item.id)?.completed ?? false,
    completed_at: progressMap.get(item.id)?.completed_at ?? null,
  }))

  const completedCount = items.filter(i => i.completed).length

  return NextResponse.json({
    items,
    meta: {
      total: items.length,
      completed: completedCount,
      pct: Math.round((completedCount / items.length) * 100),
    },
  })
}

// ─── POST handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  const company_id = body ? getString(body, 'company_id') : undefined
  const action_id  = body ? getString(body, 'action_id') : undefined
  const completed  = body ? (body.completed as boolean ?? true) : true

  if (!company_id || !action_id) {
    return NextResponse.json({ error: 'company_id and action_id required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('checklist_progress')
    .upsert(
      {
        company_id,
        action_id,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: 'company_id,action_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
