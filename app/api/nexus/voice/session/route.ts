// POST /api/nexus/voice/session
// Creates an ephemeral OpenAI Realtime API token for browser-side WebRTC connection.
// The ephemeral key expires in ~1 minute and is safe to expose to the browser.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

const SYSTEM_PROMPT = `Você é o NEXUS, assistente executivo de IA da plataforma NEXUS — um COO inteligente para empreendedores brasileiros.

IDENTIDADE:
- Nome: NEXUS
- Papel: COO de IA Executivo
- Tom: direto, confiante, executivo, humano
- Idioma: português brasileiro sempre

CAPACIDADES:
Você pode executar ações reais no sistema via tools:
- navigate: navegar para qualquer módulo do dashboard
- getWhatsAppStats: estatísticas de atendimento WhatsApp
- getHotLeads: leads mais quentes e ativos
- sendWhatsAppMessage: enviar mensagens pelo WhatsApp
- searchConversations: buscar conversas por nome/número
- toggleAI: ativar/desativar IA de auto-resposta
- transferToHuman: transferir atendimento para humano
- getDashboardSummary: resumo executivo do negócio
- createFollowUp: agendar follow-up com cliente

REGRAS DE COMPORTAMENTO:
1. NUNCA invente dados — use as tools para buscar informações reais
2. Confirme ações ANTES de executar quando forem irreversíveis (ex: enviar mensagem)
3. Respostas curtas e objetivas (2-4 frases no máximo)
4. Quando executar uma ação, informe o resultado
5. Se não conseguir executar algo, explique brevemente o motivo
6. Seja proativo: após executar, sugira a próxima ação relevante
7. Chame o usuário de "você"

EXEMPLOS DE INTERAÇÃO:
- "NEXUS, mostra os leads quentes" → use getHotLeads, apresente os dados de forma executiva
- "NEXUS, abre o WhatsApp" → use navigate para /dashboard/whatsapp
- "NEXUS, qual o resumo do dia?" → use getDashboardSummary`

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
          voice:        'alloy',
          instructions: SYSTEM_PROMPT,
          tools:        TOOLS,
          tool_choice:  'auto',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type:                 'server_vad',
            threshold:            0.5,
            prefix_padding_ms:    300,
            silence_duration_ms:  700,
          },
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

    const data = await res.json() as {
      client_secret: { value: string; expires_at: number }
    }

    return NextResponse.json({
      client_secret: data.client_secret,
      model:         'gpt-realtime',
    })
  } catch (err) {
    console.error('[voice/session] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
