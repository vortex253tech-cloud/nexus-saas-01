// POST /api/creative/pdf
// Generates structured document content (proposals, contracts, playbooks, reports) using Claude.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                     from '@anthropic-ai/sdk'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getAuthContext }            from '@/lib/auth'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

type PdfType = 'proposta' | 'relatorio' | 'contrato' | 'playbook'

const PROMPTS: Record<PdfType, string> = {
  proposta: `Você é um especialista em propostas comerciais.
Gere uma proposta comercial profissional e completa em português brasileiro.

ESTRUTURA OBRIGATÓRIA:
1. PROPOSTA COMERCIAL (título + número + data)
2. APRESENTAÇÃO DA EMPRESA (2-3 linhas)
3. ENTENDIMENTO DA NECESSIDADE
4. SOLUÇÃO PROPOSTA (detalhada, com benefícios claros)
5. INVESTIMENTO E CONDIÇÕES (valores, formas de pagamento, garantias)
6. CRONOGRAMA (se aplicável)
7. PRÓXIMOS PASSOS
8. VALIDADE DA PROPOSTA

Use linguagem profissional, persuasiva e orientada ao valor. Inclua detalhes específicos do contexto fornecido.`,

  relatorio: `Você é um especialista em relatórios executivos.
Gere um relatório executivo de desempenho em português brasileiro.

ESTRUTURA OBRIGATÓRIA:
1. RELATÓRIO EXECUTIVO (título + período + data)
2. SUMÁRIO EXECUTIVO (3-5 bullets com principais resultados)
3. RESULTADOS DO PERÍODO
   - Métricas principais vs. metas
   - Comparação com período anterior
4. ANÁLISE DE DESEMPENHO (pontos fortes e áreas de melhoria)
5. DESTAQUES E CONQUISTAS
6. DESAFIOS IDENTIFICADOS
7. RECOMENDAÇÕES ESTRATÉGICAS
8. PRÓXIMO PERÍODO — METAS E AÇÕES

Use dados do contexto fornecido. Seja analítico e orientado a decisões.`,

  contrato: `Você é um especialista em contratos de prestação de serviços.
Gere um contrato simples e profissional em português brasileiro.

ESTRUTURA OBRIGATÓRIA:
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

PARTES CONTRATANTES:
CONTRATANTE: [Nome/Empresa do cliente — preencher]
CONTRATADO: [Nome/Empresa — preencher]

CLÁUSULAS:
1. DO OBJETO (o que será entregue)
2. DO PRAZO (duração e datas)
3. DO VALOR E PAGAMENTO
4. DAS OBRIGAÇÕES DO CONTRATADO
5. DAS OBRIGAÇÕES DO CONTRATANTE
6. DA RESCISÃO
7. DA CONFIDENCIALIDADE
8. DO FORO

ASSINATURAS E DATA

Use linguagem clara e juridicamente adequada. Baseie-se no contexto fornecido.`,

  playbook: `Você é um especialista em vendas e treinamento de equipes comerciais.
Gere um playbook de vendas completo e prático em português brasileiro.

ESTRUTURA OBRIGATÓRIA:
PLAYBOOK DE VENDAS

1. VISÃO GERAL DO PRODUTO/SERVIÇO
   - O que vendemos e para quem
   - Diferenciais competitivos
   - Proposta de valor

2. PERFIL DO CLIENTE IDEAL (ICP)
   - Características demográficas e psicográficas
   - Dores e motivações principais

3. PROCESSO DE VENDAS (passo a passo)
   - Etapas do funil
   - Critérios de avanço

4. SCRIPTS DE ABORDAGEM
   - Primeiro contato (WhatsApp / telefone)
   - Follow-up
   - Reativação

5. OBJEÇÕES E RESPOSTAS
   - Top 5 objeções mais comuns + como superar cada uma

6. TÉCNICAS DE FECHAMENTO
   - 3-5 técnicas com exemplos práticos

7. MÉTRICAS E METAS
   - KPIs da equipe
   - Metas individuais e coletivas

8. MATERIAIS DE APOIO
   - Ferramentas recomendadas
   - Recursos disponíveis

Use linguagem prática, direta e motivadora. Inclua exemplos reais do contexto fornecido.`,
}

export async function POST(req: NextRequest) {
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  let body: { type?: string; context?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type    = body.type as PdfType
  const context = (body.context ?? '').trim()

  if (!type || !PROMPTS[type]) {
    return NextResponse.json({ error: 'type must be: proposta | relatorio | contrato | playbook' }, { status: 400 })
  }

  // Load company identity for personalization
  const db  = getSupabaseServerClient()
  const ctx = await getAuthContext()

  const companyId: string | null = ctx?.company.id ?? null
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
  if (overLimit) return overLimit

  let companyName = ctx?.company.name ?? 'Minha Empresa'
  let niche       = ''

  {
    const { data } = await db
      .from('company_identity')
      .select('fantasy_name, niche')
      .eq('company_id', companyId)
      .maybeSingle()
    if (data?.fantasy_name) companyName = data.fantasy_name
    if (data?.niche)        niche       = data.niche
  }

  const systemPrompt = `${PROMPTS[type]}

Empresa: ${companyName}${niche ? ` | Nicho: ${niche}` : ''}
Contexto fornecido pelo usuário: ${context || 'Não especificado — use informações genéricas adequadas.'}

IMPORTANTE: Retorne APENAS o documento formatado em texto, sem introduções ou explicações. Comece diretamente com o documento.`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role:    'user',
        content: `Gere o documento com base no contexto: ${context || 'informações genéricas'}`,
      }],
      system: systemPrompt,
    })

    const content = (message.content[0] as { type: string; text: string })?.text ?? ''

    // Persist to ai_generated_assets (best effort)
    db.from('ai_generated_assets').insert({
      company_id: companyId,
      type:       `pdf_${type}`,
      channel:    'document',
      content,
      metadata:   { context, pdf_type: type },
    }).then(() => {}, () => {})

    void incrementAiUsage(companyId)
    return NextResponse.json({ content, type, company_name: companyName })
  } catch (err) {
    console.error('[creative/pdf] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }
}
