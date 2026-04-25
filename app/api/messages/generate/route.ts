// POST /api/messages/generate — AI-powered message generation

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { prompt, type = 'email' } = await req.json() as {
    prompt: string
    type?:  'email' | 'whatsapp'
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 })
  }

  // Stub response when no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = type === 'whatsapp'
      ? { content: `Olá {{nome}},\n\n${prompt.trim()}\n\nAtenciosamente,\nEquipe {{empresa}}` }
      : {
          subject: 'Mensagem automática — {{empresa}}',
          content: `<p>Olá <strong>{{nome}}</strong>,</p><p>${prompt.trim()}</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>`,
        }
    return NextResponse.json({ ...stub, simulated: true })
  }

  const client = new Anthropic()

  const channelInstruction = type === 'whatsapp'
    ? 'Crie uma mensagem de WhatsApp curta, amigável e direta.'
    : 'Crie um e-mail profissional em HTML com tags <p>, <strong>. Não inclua <html>, <body> ou CSS externo.'

  const subjectInstruction = type === 'email'
    ? '\n"subject": "assunto do e-mail (obrigatório)",'
    : ''

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages:   [{
        role:    'user',
        content: `Você é um especialista em comunicação empresarial brasileira. ${channelInstruction}

Situação: "${prompt.trim()}"

Use estas variáveis quando pertinente:
- {{nome}} — nome do cliente
- {{empresa}} — nome da empresa
- {{valor}} — valor monetário
- {{vencimento}} — data de vencimento
- {{link_pagamento}} — link de pagamento

Responda APENAS em JSON válido (sem markdown):
{${subjectInstruction}
"content": "corpo da mensagem"
}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    // Strip possible markdown fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean) as { subject?: string; content: string }
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[messages/generate]', err)
    return NextResponse.json({ error: 'Erro ao gerar mensagem com IA' }, { status: 500 })
  }
}
