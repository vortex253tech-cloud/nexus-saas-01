// POST /api/nexus/voice/session
// Creates an ephemeral OpenAI Realtime API token for browser-side WebRTC connection.
// Endpoint: POST https://api.openai.com/v1/realtime/sessions
// The ephemeral key expires in ~1 minute and is safe to expose to the browser.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

const REALTIME_MODEL = 'gpt-4o-realtime-preview'

const SYSTEM_PROMPT = `Você é o NEXUS — Sistema Operacional de IA da empresa. COO executivo de alto nível.
Você é o cérebro operacional central. Fala português, age como um COO + CEO de IA de elite.

IDENTIDADE:
- Nome: NEXUS
- Papel: Sistema Operacional Central — opera o negócio inteiro por comando de voz
- Tom: direto, confiante, executivo, assertivo, nunca vago, nunca verbose
- Personalidade: inteligente, proativo, decisivo — o sistema que "faz acontecer"
- Limite de resposta: máximo 2-3 frases. Seja cirúrgico.

OPERAÇÕES DISPONÍVEIS (use as tools sem hesitar):
WhatsApp & Atendimento:
  getWhatsAppStats       → métricas gerais de atendimento
  getUnreadMessages      → mensagens não lidas pendentes
  getHotLeads            → leads mais ativos e quentes
  sendWhatsAppMessage    → enviar mensagem a um contato (CONFIRME antes de enviar)
  searchConversations    → buscar conversa por nome ou número
  getConversationHistory → histórico de mensagens
  toggleAI               → ligar/desligar IA em conversa
  transferToHuman        → transferir para humano
  markConversationRead   → marcar como lida

CRM & Pipeline:
  getPipelineLeads       → leads e distribuição por estágio
  updateLeadStage        → mover lead de estágio
  createFollowUp         → agendar follow-up

Financeiro:
  getFinancialSummary    → faturamento, despesas, resultado
  getDashboardSummary    → visão executiva completa
  getSystemStatus        → saúde do sistema

Operações avançadas:
  analyzeCompany         → análise executiva completa da empresa
  orchestrateAgent       → aciona agente IA especializado (Marketing, Growth, Financeiro)
  getAutomations         → lista automações ativas
  triggerAutomation      → dispara uma automação
  createTask             → cria tarefa ou projeto

Navegação:
  navigate               → abre módulo do dashboard
    Rotas: /dashboard/whatsapp, /dashboard/leads, /dashboard/revenue,
           /dashboard/financeiro, /dashboard/nexus, /dashboard/automations,
           /dashboard/pipeline, /dashboard/settings, /dashboard/agents,
           /dashboard/growth-map, /dashboard/projects

PROTOCOLO:
1. NUNCA invente dados — use tools
2. Confirme ANTES de enviar mensagem (ação irreversível)
3. 2-3 frases máx. Executivo, não verbose.
4. Após executar: resultado + próxima ação estratégica
5. Detecte intenção: "leads" → getHotLeads; "financeiro" → getFinancialSummary
6. Comando complexo → quebre em etapas, execute sequencialmente
7. Quando estiver em CEO MODE, monitore proativamente e sugira ações`

const TOOLS = [
  { type: 'function', name: 'navigate',
    description: 'Navega para uma página do dashboard NEXUS',
    parameters: { type: 'object', properties: {
      path:      { type: 'string', description: 'Ex: /dashboard/whatsapp' },
      page_name: { type: 'string', description: 'Nome amigável' },
    }, required: ['path'] },
  },
  { type: 'function', name: 'getWhatsAppStats',
    description: 'Estatísticas do WhatsApp: total conversas, ativas, IA ativa, não lidas',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getUnreadMessages',
    description: 'Conversas com mensagens não lidas pendentes',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getHotLeads',
    description: 'Leads mais quentes e ativos, ordenados por atividade recente',
    parameters: { type: 'object', properties: {
      limit: { type: 'number', description: 'Quantidade (padrão 5, máx 10)' },
    }},
  },
  { type: 'function', name: 'sendWhatsAppMessage',
    description: 'Envia mensagem WhatsApp — CONFIRME antes',
    parameters: { type: 'object', properties: {
      phone:           { type: 'string', description: 'Número com DDI, só dígitos' },
      message:         { type: 'string', description: 'Conteúdo da mensagem' },
      conversation_id: { type: 'string', description: 'ID da conversa (opcional)' },
    }, required: ['phone', 'message'] },
  },
  { type: 'function', name: 'searchConversations',
    description: 'Busca conversas por nome ou número',
    parameters: { type: 'object', properties: {
      query: { type: 'string', description: 'Nome ou número' },
    }, required: ['query'] },
  },
  { type: 'function', name: 'getConversationHistory',
    description: 'Histórico de mensagens de uma conversa',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      limit:           { type: 'number', description: 'Nº de mensagens (padrão 10)' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'toggleAI',
    description: 'Ativa ou desativa IA em conversa WhatsApp',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      enabled:         { type: 'boolean' },
    }, required: ['conversation_id', 'enabled'] },
  },
  { type: 'function', name: 'transferToHuman',
    description: 'Transfere conversa para atendimento humano',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      note:            { type: 'string', description: 'Nota de transferência (opcional)' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'markConversationRead',
    description: 'Marca conversa como lida',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
    }, required: ['conversation_id'] },
  },
  { type: 'function', name: 'getPipelineLeads',
    description: 'Leads e distribuição por estágio do pipeline',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'updateLeadStage',
    description: 'Move lead para outro estágio do pipeline',
    parameters: { type: 'object', properties: {
      conversation_id: { type: 'string' },
      stage:           { type: 'string', description: 'Ex: proposta, negociação, fechado' },
    }, required: ['conversation_id', 'stage'] },
  },
  { type: 'function', name: 'createFollowUp',
    description: 'Cria follow-up com um cliente',
    parameters: { type: 'object', properties: {
      phone:        { type: 'string' },
      contact_name: { type: 'string' },
      message:      { type: 'string' },
      scheduled_at: { type: 'string', description: 'ISO 8601' },
    }, required: ['phone', 'message', 'scheduled_at'] },
  },
  { type: 'function', name: 'getFinancialSummary',
    description: 'Faturamento, despesas e resultado do mês',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getDashboardSummary',
    description: 'Visão executiva: conversas, leads, financeiro',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'getSystemStatus',
    description: 'Saúde operacional do sistema',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'analyzeCompany',
    description: 'Análise executiva completa da empresa: saúde, oportunidades, alertas, próximas ações',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'orchestrateAgent',
    description: 'Aciona agente IA especializado para uma tarefa específica',
    parameters: { type: 'object', properties: {
      agent: { type: 'string', description: 'Agente: marketing, growth, financeiro, projetos, suporte, operacoes' },
      task:  { type: 'string', description: 'O que o agente deve fazer' },
    }, required: ['agent', 'task'] },
  },
  { type: 'function', name: 'getAutomations',
    description: 'Lista automações ativas e em execução',
    parameters: { type: 'object', properties: {} },
  },
  { type: 'function', name: 'triggerAutomation',
    description: 'Dispara uma automação específica',
    parameters: { type: 'object', properties: {
      automation_id:   { type: 'string', description: 'ID da automação' },
      automation_name: { type: 'string', description: 'Nome amigável' },
    }, required: ['automation_id'] },
  },
  { type: 'function', name: 'createTask',
    description: 'Cria uma tarefa ou nota operacional',
    parameters: { type: 'object', properties: {
      title:       { type: 'string', description: 'Título da tarefa' },
      description: { type: 'string', description: 'Descrição detalhada' },
      priority:    { type: 'string', description: 'low, medium, high, critical' },
      due_date:    { type: 'string', description: 'Data limite ISO 8601 (opcional)' },
    }, required: ['title'] },
  },
]

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
  }

  try {
    // Correct endpoint: /v1/realtime/sessions (not client_secrets)
    // Body: fields at top-level, NO 'session' wrapper, NO 'type' field
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:        REALTIME_MODEL,
        modalities:   ['audio', 'text'],
        instructions: SYSTEM_PROMPT,
        voice:        'alloy',
        tool_choice:  'auto',
        tools:        TOOLS,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type:                'server_vad',
          threshold:           0.5,
          prefix_padding_ms:   300,
          silence_duration_ms: 700,
        },
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[voice/session] OpenAI error:', res.status, text)

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

    const raw = await res.text()
    console.log('[voice/session] OpenAI response:', raw.slice(0, 400))

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(raw) } catch { /* non-JSON */ }

    // Extract ephemeral key from client_secret.value
    type MaybeSecret = { value?: string; expires_at?: number } | undefined
    const csObj   = data?.client_secret as MaybeSecret
    const ekValue = csObj?.value ?? null

    if (!ekValue) {
      console.error('[voice/session] No ephemeral key found in:', raw.slice(0, 400))
      return NextResponse.json(
        { error: 'OpenAI did not return an ephemeral key', raw: raw.slice(0, 400) },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ephemeral_key: ekValue,
      expires_at:    csObj?.expires_at ?? null,
      model:         REALTIME_MODEL,
    })
  } catch (err) {
    console.error('[voice/session] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
