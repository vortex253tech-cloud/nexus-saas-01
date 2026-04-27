// POST /api/ai/generate-flow — AI generates a growth map from a business prompt

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import Anthropic                     from '@anthropic-ai/sdk'

const SYSTEM = `Você é um especialista em automação de negócios e CRM.
Dado um objetivo de negócio, gere um fluxo de automação no formato JSON.

Tipos de nós disponíveis:
- data_analysis: Analisa dados de clientes (dataSource: "overdue" | "inactive" | "financial" | "all_clients")
- opportunity: IA detecta oportunidade (focus: string descrevendo o foco)
- decision: IA toma decisão (question: string com a pergunta de decisão)
- message_gen: Gera mensagem (messageType: "recovery"|"upsell"|"reactivation"|"campaign", channel: "email"|"whatsapp", tone: string)
- auto_action: Executa ação (channel: "email"|"whatsapp", segment: "overdue"|"inactive"|"all")
- result: Nó de resultado final (metrics: string[])

Responda APENAS com JSON válido (sem markdown) no formato:
{
  "name": "Nome do fluxo",
  "description": "Descrição do fluxo",
  "nodes": [
    { "id": "n1", "type": "data_analysis", "position": {"x": 50, "y": 200}, "data": {"label": "...", "config": {...}} }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" }
  ]
}

Regras:
- Use posições x com incremento de ~270 por nó (50, 320, 590, 860, 1130...)
- y sempre 200 para manter fluxo horizontal
- Todo fluxo deve começar com data_analysis e terminar com result
- Máximo 6 nós`

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI não configurada' }, { status: 503 })
  }

  const body = await req.json() as { prompt?: string }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'Descreva o objetivo do fluxo' }, { status: 400 })
  }

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system:     SYSTEM,
      messages: [{
        role:    'user',
        content: `Crie um fluxo de automação para: ${body.prompt}`,
      }],
    })

    const text  = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const flow  = JSON.parse(clean) as {
      name: string; description: string
      nodes: unknown[]; edges: unknown[]
    }

    if (!flow.nodes?.length) throw new Error('Fluxo inválido')

    return NextResponse.json({ flow })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
