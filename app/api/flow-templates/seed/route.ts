// POST /api/flow-templates/seed
// Seeds the 3 recommended monetisation flow templates.
// Idempotent — uses name-based upsert so re-running is safe.
// Protected by CRON_SECRET to prevent public abuse.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TEMPLATES = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Recover Overdue Clients
  // ──────────────────────────────────────────────────────────────────────────
  {
    name:        'Recuperar Clientes Inadimplentes',
    description: 'Detecta clientes com faturas vencidas e envia sequência de cobrança por email + WhatsApp, com link de pagamento gerado automaticamente.',
    category:    'revenue',
    icon:        '💰',
    color:       'amber',
    tier:        'pro',
    is_public:   true,
    nodes: [
      {
        id: 'n1', type: 'TRIGGER',
        config: { triggerType: 'scheduled', schedule: '0 9 * * *' },
        label: 'Diariamente 09h',
      },
      {
        id: 'n2', type: 'ANALYSIS',
        config: { dataSource: 'overdue', limit: 100 },
        label: 'Buscar Inadimplentes',
      },
      {
        id: 'n3', type: 'ACTION',
        config: { actionType: 'CREATE_PAYMENT_LINK' },
        label: 'Gerar Link de Pagamento',
      },
      {
        id: 'n4', type: 'ACTION',
        config: {
          actionType: 'SEND_EMAIL',
          subject: 'Pendência financeira — {{name}}',
          template: 'Olá {{name}}, sua fatura está vencida. Pague agora: {{payment_link}}',
        },
        label: 'Enviar Email de Cobrança',
      },
      {
        id: 'n5', type: 'ACTION',
        config: {
          actionType: 'SEND_WHATSAPP',
          template: 'Oi {{name}}, temos uma fatura vencida no seu nome. Regularize agora: {{payment_link}}',
        },
        label: 'WhatsApp de Cobrança',
      },
      {
        id: 'n6', type: 'RESULT',
        config: { message: 'Cobrança enviada com sucesso' },
        label: 'Resultado',
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n5', target: 'n6' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Increase Revenue — Upsell High-Value Clients
  // ──────────────────────────────────────────────────────────────────────────
  {
    name:        'Aumentar Receita — Upsell Clientes VIP',
    description: 'Identifica clientes com alto valor histórico e envia proposta personalizada de upgrade/upsell por email.',
    category:    'revenue',
    icon:        '📈',
    color:       'emerald',
    tier:        'pro',
    is_public:   true,
    nodes: [
      {
        id: 'n1', type: 'TRIGGER',
        config: { triggerType: 'scheduled', schedule: '0 10 * * 1' },
        label: 'Toda Segunda 10h',
      },
      {
        id: 'n2', type: 'ANALYSIS',
        config: { dataSource: 'clients', limit: 50, filters: { minRevenue: 5000 } },
        label: 'Clientes Alto Valor',
      },
      {
        id: 'n3', type: 'DECISION',
        config: {
          field: 'count',
          operator: 'greater_than',
          value: 0,
          trueLabel: 'has_clients',
          falseLabel: 'no_clients',
        },
        label: 'Há Clientes VIP?',
      },
      {
        id: 'n4', type: 'ACTION',
        config: {
          actionType: 'SEND_EMAIL',
          subject: 'Uma proposta especial para você, {{name}}',
          template: 'Olá {{name}}, por ser um dos nossos melhores clientes, temos uma oferta exclusiva. Vamos conversar?',
        },
        label: 'Email Upsell',
      },
      {
        id: 'n5', type: 'RESULT',
        config: { message: 'Campanha de upsell concluída' },
        label: 'Resultado',
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', condition: 'has_clients' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Reactivation Campaign — Inactive Clients
  // ──────────────────────────────────────────────────────────────────────────
  {
    name:        'Reativação de Clientes Inativos',
    description: 'Detecta clientes sem movimentação há 30+ dias e inicia campanha de reativação multicanal com oferta personalizada.',
    category:    'retention',
    icon:        '🔄',
    color:       'blue',
    tier:        'pro',
    is_public:   true,
    nodes: [
      {
        id: 'n1', type: 'TRIGGER',
        config: { triggerType: 'client_at_risk' },
        label: 'Cliente em Risco',
      },
      {
        id: 'n2', type: 'ANALYSIS',
        config: { dataSource: 'at_risk_clients', inactiveDays: 30, limit: 100 },
        label: 'Analisar Inativos',
      },
      {
        id: 'n3', type: 'ACTION',
        config: {
          actionType: 'SEND_WHATSAPP',
          template: 'Olá {{name}}, sentimos sua falta! 😊 Que tal agendarmos uma conversa? Temos novidades que podem te interessar.',
        },
        label: 'WhatsApp de Reativação',
      },
      {
        id: 'n4', type: 'ACTION',
        config: {
          actionType: 'SEND_EMAIL',
          subject: '{{name}}, temos saudade de você!',
          template: 'Olá {{name}},\n\nFaz um tempo que não nos falamos. Gostaríamos de saber como você está e compartilhar novidades.\n\nAcesse sua conta e veja o que preparamos para você.',
        },
        label: 'Email de Reativação',
      },
      {
        id: 'n5', type: 'ACTION',
        config: {
          actionType: 'UPDATE_CLIENT',
          updates: { status: 'pending', notes: 'Campanha de reativação enviada em {{date}}' },
        },
        label: 'Marcar como Em Reativação',
      },
      {
        id: 'n6', type: 'RESULT',
        config: { message: 'Campanha de reativação disparada' },
        label: 'Resultado',
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n5', target: 'n6' },
    ],
  },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()
  const results: { name: string; action: 'inserted' | 'skipped' }[] = []

  for (const tpl of TEMPLATES) {
    // Check if a template with this name already exists (idempotency)
    const { data: existing } = await db
      .from('flow_templates')
      .select('id')
      .eq('name', tpl.name)
      .maybeSingle()

    if (existing) {
      results.push({ name: tpl.name, action: 'skipped' })
      continue
    }

    await db.from('flow_templates').insert({
      name:        tpl.name,
      description: tpl.description,
      category:    tpl.category,
      icon:        tpl.icon,
      color:       tpl.color,
      tier:        tpl.tier,
      is_public:   tpl.is_public,
      nodes:       tpl.nodes,
      edges:       tpl.edges,
    })

    results.push({ name: tpl.name, action: 'inserted' })
  }

  return NextResponse.json({ seeded: results })
}
