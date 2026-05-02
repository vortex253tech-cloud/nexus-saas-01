// POST /api/ai/business-analysis — AI Business Advisor
// Fetches financial, client, message, and execution data, then calls Claude
// to produce a structured analysis with insights, risks, opportunities, and actions.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import {
  fetchBusinessData,
  buildAnalysisContext,
  buildStubAnalysis,
  type BusinessAnalysis,
} from '@/lib/services/business-advisor'

export const dynamic = 'force-dynamic'

// ─── Company resolver (same pattern as /api/ai/chat) ──────────────────────

async function resolveCompany(bodyCompanyId?: string): Promise<string | null> {
  try {
    const ctx = await getAuthContext()
    if (ctx?.company?.id) return ctx.company.id
  } catch { /* auth not available */ }

  if (bodyCompanyId) return bodyCompanyId

  try {
    const db = getSupabaseServerClient()
    const { data } = await db.from('companies').select('id').limit(1).single()
    if (data?.id) return data.id as string
  } catch { /* nothing */ }

  return null
}

// ─── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `Você é um COO de IA especializado em análise de negócios brasileiros.
Receberá dados reais de uma empresa e deve retornar uma análise estruturada em JSON.

REGRAS CRÍTICAS:
1. Responda APENAS com JSON válido — sem markdown, sem texto extra.
2. Use português brasileiro em todos os textos.
3. Formate valores monetários como "R$ 4.200/mês" (com pontos e vírgulas BR).
4. Seja específico: mencione números reais do contexto, não generalidades.
5. Priorize ações que o dono pode tomar HOJE com impacto imediato.
6. Os campos deadline devem ser: "Hoje", "3 dias", "1 semana", "2 semanas" ou "1 mês".
7. O score de saúde deve refletir a situação REAL dos dados (não seja otimista à toa).

SCHEMA DE SAÍDA (retorne exatamente este formato):
{
  "score": <número 0-100>,
  "summary": "<2-3 frases executivas sobre a situação atual>",
  "score_breakdown": {
    "collections": <0-100>,
    "cashflow": <0-100>,
    "growth": <0-100>,
    "operations": <0-100>
  },
  "insights": [
    {
      "id": "i-1",
      "title": "<título curto>",
      "description": "<descrição de 1-2 frases com dados reais>",
      "impact": "<valor em R$ ou percentual>",
      "category": "<revenue|cost|retention|operational|pricing>",
      "priority": "<high|medium|low>",
      "icon": "<emoji>",
      "data_source": "<financial|clients|messages|executions>"
    }
  ],
  "risks": [
    {
      "id": "r-1",
      "title": "<título do risco>",
      "description": "<o que pode acontecer>",
      "severity": "<critical|high|medium|low>",
      "probability": "<high|medium|low>",
      "impact": "<consequência quantificada>",
      "mitigation": "<ação concreta para mitigar>"
    }
  ],
  "opportunities": [
    {
      "id": "o-1",
      "title": "<título da oportunidade>",
      "description": "<como aproveitar>",
      "potential_gain": "<R$ estimado/período>",
      "timeframe": "<prazo para ver resultado>",
      "effort": "<low|medium|high>",
      "category": "<categoria>",
      "why_now": "<por que agir agora>"
    }
  ],
  "recommended_actions": [
    {
      "id": "a-1",
      "title": "<nome da ação>",
      "description": "<o que fazer>",
      "priority": <1-5>,
      "impact_estimate": "<R$ impacto>",
      "deadline": "<Hoje|3 dias|1 semana|...>",
      "steps": ["<passo 1>", "<passo 2>", "<passo 3>"],
      "auto_executable": <true|false>,
      "execution_type": "<email|whatsapp|automation|analysis|manual>"
    }
  ]
}

Retorne entre 3-5 insights, 2-4 risks, 2-3 opportunities, e 3-5 recommended_actions.
Ordene recommended_actions por priority (1 = mais urgente).`
}

// ─── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body        = await readJsonObject(req)
    const bodyCompany = body ? getString(body, 'company_id') : undefined

    // 1. Resolve company
    const companyId = await resolveCompany(bodyCompany ?? undefined)
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch all business data in parallel
    const data = await fetchBusinessData(companyId)

    // 3. Stub mode when no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[business-analysis] no API key — returning stub analysis')
      const stub = buildStubAnalysis(data)
      return NextResponse.json(stub)
    }

    // 4. Build context for Claude
    const context = buildAnalysisContext(data)

    // 5. Call Claude Sonnet for deep analysis
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const aiRes = await ai.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     buildSystemPrompt(),
      messages: [{
        role:    'user',
        content: `Analise os dados desta empresa e retorne o JSON estruturado conforme as instruções.\n\n${context}`,
      }],
    })

    const raw = aiRes.content[0]?.type === 'text' ? aiRes.content[0].text.trim() : null
    if (!raw) throw new Error('Empty AI response')

    // 6. Strip markdown fences and parse JSON
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,          '')
      .trim()

    let analysis: BusinessAnalysis
    try {
      const parsed = JSON.parse(cleaned)
      analysis = {
        ...parsed,
        analyzed_at: new Date().toISOString(),
        data_coverage: {
          financial:  data.financial.length  > 0,
          clients:    data.clients.length    > 0,
          messages:   data.messages.length   > 0,
          executions: data.executions.length > 0,
        },
      } as BusinessAnalysis
    } catch {
      console.error('[business-analysis] JSON parse failed — falling back to stub')
      const stub = buildStubAnalysis(data)
      return NextResponse.json(stub)
    }

    console.log('[business-analysis] ✅ score:', analysis.score, '| insights:', analysis.insights?.length)
    return NextResponse.json(analysis)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[business-analysis] ERROR:', msg)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
