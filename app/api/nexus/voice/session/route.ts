// POST /api/nexus/voice/session
// Creates an ephemeral OpenAI Realtime API token for browser-side WebRTC connection.
// The ephemeral key expires in ~1 minute and is safe to expose to the browser.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

const SYSTEM_PROMPT = `Você é o NEXUS — COO de IA Executivo da plataforma NEXUS.
Você é o cérebro operacional de um negócio brasileiro. Fala português, age como um COO de alto nível.

IDENTIDADE:
- Nome: NEXUS
- Papel: COO de IA — opera o negócio inteiro por comando de voz
- Tom: direto, confiante, executivo, sem rodeios
- Personalidade: inteligente, proativo, assertivo, nunca vago

OPERAÇÕES QUE VOCÊ CONTROLA (via tools):
WhatsApp & Atendimento:
  getWhatsAppStats       → métricas gerais de atendimento
  getUnreadMessages      → mensagens não lidas pendentes
  getHotLeads            → leads mais ativos e quentes
  sendWhatsAppMessage    → enviar mensagem a um contato
  searchConversations    → buscar conversa por nome ou número
  getConversationHistory → histórico de mensagens de uma conversa
  toggleAI               → ligar/desligar IA em uma conversa
  transferToHuman        → transferir conversa para humano
  markConversationRead   → marcar conversa como lida

CRM & Pipeline:
  getPipelineLeads       → leads e distribuição por estágio
  updateLeadStage        → mover lead para outro estágio
  createFollowUp         → agendar follow-up com cliente

Financeiro & Negócio:
  getFinancialSummary    → faturamento, despesas, resultado do mês
  getDashboardSummary    → visão executiva completa (conversas + mensagens)
  getSystemStatus        → saúde operacional do sistema

Navegação:
  navigate               → abrir qualquer módulo do dashboard
    Rotas disponíveis: /dashboard/whatsapp, /dashboard/leads,
    /dashboard/revenue, /dashboard/financeiro, /dashboard/nexus,
    /dashboard/automations, /dashboard/pipeline, /dashboard/settings

PROTOCOLO DE OPERAÇÃO:
1. NUNCA invente dados — use tools para buscar informações reais
2. Confirme ANTES de enviar mensagem a alguém (ação irreversível)
3. Respostas curtas: 1-3 frases. Seja executivo, não verbose
4. Após executar, diga o resultado e sugira próxima ação estratégica
5. Detecte intenção implícita: "leads" → getHotLeads; "mensagens" → getUnreadMessages
6. Chame o usuário de "você"
7. Quando não souber algo, busque via tool antes de responder

EXEMPLOS DE COMANDOS → AÇÃO:
"mostra os leads quentes" → getHotLeads(5)
"tem mensagem não lida?" → getUnreadMessages()
"como está o faturamento?" → getFinancialSummary()
"abre o WhatsApp" → navigate("/dashboard/whatsapp")
"resumo do dia" → getDashboardSummary() + getUnreadMessages()
"manda mensagem para João" → searchConversations("João") → confirma → sendWhatsAppMessage()
"status do sistema" → getSystemStatus()
"move lead X para proposta" → updateLeadStage(id, "proposta")
"marca como lida" → markConversationRead(id)`

const TOOLS = [
  {
    type: 'function',
    name: 'navigate',
    description: 'Navega para uma página do dashboard NEXUS',
    parameters: {
      type: 'object',
      properties: {
        path:      { type: 'string', description: 'Caminho da página. Ex: /dashboard/whatsapp, /dashboard/leads, /dashboard/revenue, /dashboard/financeiro, /dashboard/nexus, /dashboard/automations' },
        page_name: { type: 'string', description: 'Nome amigável da página para confirmar ao usuário' },
      },
      required: ['path'],
    },
  },
  {
    type: 'function',
    name: 'getWhatsAppStats',
    description: 'Busca estatísticas do WhatsApp: total de conversas, ativas, com IA ligada, mensagens recentes',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'getHotLeads',
    description: 'Busca os leads mais quentes e ativos do WhatsApp, ordenados por atividade recente',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Quantidade de leads a retornar (padrão: 5, máximo: 10)' },
      },
    },
  },
  {
    type: 'function',
    name: 'sendWhatsAppMessage',
    description: 'Envia uma mensagem via WhatsApp para um contato específico',
    parameters: {
      type: 'object',
      properties: {
        phone:           { type: 'string', description: 'Número de telefone (somente dígitos, com DDI)' },
        message:         { type: 'string', description: 'Conteúdo da mensagem a enviar' },
        conversation_id: { type: 'string', description: 'ID da conversa existente (opcional)' },
      },
      required: ['phone', 'message'],
    },
  },
  {
    type: 'function',
    name: 'searchConversations',
    description: 'Busca conversas do WhatsApp por nome do contato ou número de telefone',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome ou número para buscar' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'toggleAI',
    description: 'Ativa ou desativa a IA de auto-resposta em uma conversa do WhatsApp',
    parameters: {
      type: 'object',
      properties: {
        conversation_id: { type: 'string', description: 'ID da conversa' },
        enabled:         { type: 'boolean', description: 'true para ativar, false para desativar' },
      },
      required: ['conversation_id', 'enabled'],
    },
  },
  {
    type: 'function',
    name: 'transferToHuman',
    description: 'Transfere uma conversa do WhatsApp para atendimento humano, desativando a IA',
    parameters: {
      type: 'object',
      properties: {
        conversation_id: { type: 'string', description: 'ID da conversa a transferir' },
        note:            { type: 'string', description: 'Nota de transferência (opcional)' },
      },
      required: ['conversation_id'],
    },
  },
  {
    type: 'function',
    name: 'getDashboardSummary',
    description: 'Busca um resumo executivo do negócio com métricas principais: conversas, leads, financeiro',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'createFollowUp',
    description: 'Cria um lembrete de follow-up para retornar contato com um cliente',
    parameters: {
      type: 'object',
      properties: {
        phone:        { type: 'string', description: 'Número do contato' },
        contact_name: { type: 'string', description: 'Nome do contato' },
        message:      { type: 'string', description: 'Mensagem ou contexto do follow-up' },
        scheduled_at: { type: 'string', description: 'Data e hora agendada no formato ISO 8601' },
      },
      required: ['phone', 'message', 'scheduled_at'],
    },
  },
]

export async function POST(req: NextRequest) {
  // Auth check
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        session: {
          type:         'realtime',
          model:        'gpt-realtime',
          instructions: SYSTEM_PROMPT,
        },
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[voice/session] OpenAI error:', res.status, text)

      // Parse OpenAI error for a friendlier message
      let friendlyError = `OpenAI ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } }
        if (parsed.error?.message) friendlyError = parsed.error.message
      } catch { /* use raw text */ }

      return NextResponse.json({
        error:   friendlyError,
        details: text,
        status:  res.status,
      }, { status: 502 })
    }

    // Log the full response to diagnose structure changes between API versions
    const raw = await res.text()
    console.log('[voice/session] OpenAI raw response:', raw.slice(0, 500))

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(raw) } catch { /* non-JSON */ }

    // Resolve ephemeral key regardless of nesting level
    type MaybeSecret = { value?: string; expires_at?: number } | undefined
    const csObj   = (data?.client_secret as MaybeSecret) ?? (data as MaybeSecret)
    const ekValue = csObj?.value ?? null

    if (!ekValue) {
      console.error('[voice/session] No ephemeral key found in:', raw.slice(0, 500))
      return NextResponse.json(
        { error: 'OpenAI did not return an ephemeral key', raw: raw.slice(0, 500) },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ephemeral_key: ekValue,
      expires_at:    csObj?.expires_at ?? null,
    })
  } catch (err) {
    console.error('[voice/session] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
