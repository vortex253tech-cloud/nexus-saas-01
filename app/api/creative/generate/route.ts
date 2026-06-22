import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerateType = 'message' | 'campaign' | 'subject' | 'caption' | 'ad_copy' | 'landing_section'
type Channel      = 'whatsapp' | 'email' | 'instagram' | 'sms' | 'general'
type Objective    = 'cobranca' | 'reativacao' | 'lancamento' | 'promocao' | 'boas_vindas' | 'follow_up'

interface CompanyIdentity {
  fantasy_name: string
  slogan:        string | null
  ai_name:       string
  ai_role:       string
  ai_style:      string
  niche:         string | null
  primary_color: string | null
  tone_keywords: string[]
}

// ─── Helper: load identity ────────────────────────────────────────────────────

async function loadIdentity(db: ReturnType<typeof getSupabaseServerClient>, companyId: string): Promise<CompanyIdentity> {
  const { data } = await db
    .from('company_identity')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (data) return data as CompanyIdentity

  // Fallback: read from companies table
  const { data: company } = await db
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  return {
    fantasy_name:  company?.name ?? 'Minha Empresa',
    slogan:        null,
    ai_name:       'Assistente',
    ai_role:       'Assistente de atendimento',
    ai_style:      'amigavel',
    niche:         null,
    primary_color: null,
    tone_keywords: [],
  }
}

// ─── Helper: build system prompt ──────────────────────────────────────────────

function buildSystemPrompt(identity: CompanyIdentity, channel: Channel): string {
  const tone = identity.tone_keywords.length
    ? `Palavras-chave de tom: ${identity.tone_keywords.join(', ')}.`
    : ''

  const niche = identity.niche ? `Nicho: ${identity.niche}.` : ''
  const slogan = identity.slogan ? `Slogan: "${identity.slogan}".` : ''

  return `Você é um especialista em copywriting e marketing digital.
Você está criando conteúdo EXCLUSIVAMENTE para a empresa "${identity.fantasy_name}".
${slogan}
${niche}
${tone}
Tom de voz: ${identity.ai_style}.

REGRAS ABSOLUTAS:
- NUNCA mencione "NEXUS", "IA" ou qualquer plataforma de tecnologia
- NUNCA mencione que o conteúdo foi gerado por IA
- SEMPRE use o nome "${identity.fantasy_name}" como remetente
- O conteúdo deve parecer escrito por um humano da empresa
- Canal de comunicação: ${channel}
- Escreva em português do Brasil
- Seja direto, persuasivo e humano`
}

// ─── Helper: build user prompt ────────────────────────────────────────────────

function buildUserPrompt(
  type:      GenerateType,
  channel:   Channel,
  objective: Objective,
  context:   string,
  identity:  CompanyIdentity,
): string {
  const templates: Record<GenerateType, string> = {
    message: `Crie uma mensagem de ${channel} com objetivo de ${objective}.
Empresa: ${identity.fantasy_name}
Contexto adicional: ${context || 'mensagem padrão'}

Formato: Apenas o texto da mensagem, pronto para enviar. Sem títulos, sem explicações.
${channel === 'whatsapp' ? 'Use emojis moderadamente. Máximo 3 parágrafos.' : ''}
${channel === 'email' ? 'Tom profissional mas caloroso. 3-4 parágrafos.' : ''}
${channel === 'instagram' ? 'Tom engajador. Inclua hashtags relevantes no final.' : ''}`,

    campaign: `Crie uma campanha completa de ${channel} com objetivo de ${objective}.
Empresa: ${identity.fantasy_name}
Contexto: ${context || 'campanha padrão'}

Retorne JSON com esta estrutura EXATA:
{
  "name": "Nome da campanha",
  "objective": "${objective}",
  "audience": "Descrição do público-alvo",
  "messages": [
    {"step": 1, "delay": "imediato", "channel": "${channel}", "content": "mensagem 1"},
    {"step": 2, "delay": "2 dias", "channel": "${channel}", "content": "mensagem 2"},
    {"step": 3, "delay": "5 dias", "channel": "${channel}", "content": "mensagem 3"}
  ],
  "expected_results": {
    "open_rate": "XX%",
    "conversion_rate": "XX%",
    "revenue_potential": "Descrição"
  }
}`,

    subject: `Crie 5 opções de assunto de email para campanha de ${objective}.
Empresa: ${identity.fantasy_name}
Contexto: ${context || 'email padrão'}

Retorne apenas as 5 opções, uma por linha. Sem numeração, sem explicações.
Cada assunto deve ter entre 40-60 caracteres. Seja criativo e persuasivo.`,

    caption: `Crie uma legenda para post de Instagram sobre ${objective}.
Empresa: ${identity.fantasy_name}
Contexto: ${context || 'post padrão'}

Inclua:
- Gancho na primeira linha (para parar o scroll)
- Corpo do texto (2-3 parágrafos curtos)
- CTA claro
- 5-8 hashtags relevantes`,

    ad_copy: `Crie texto de anúncio para ${channel} com objetivo de ${objective}.
Empresa: ${identity.fantasy_name}
Contexto: ${context || 'anúncio padrão'}

Retorne JSON:
{
  "headline": "título principal (max 30 chars)",
  "primary_text": "texto principal do anúncio",
  "description": "descrição curta (max 25 chars)",
  "cta": "botão de ação"
}`,

    landing_section: `Crie o conteúdo de uma seção de landing page para ${objective}.
Empresa: ${identity.fantasy_name}
Contexto: ${context || 'landing page padrão'}

Retorne JSON:
{
  "headline": "título principal",
  "subheadline": "subtítulo",
  "body": "texto do corpo (2-3 parágrafos)",
  "benefits": ["benefício 1", "benefício 2", "benefício 3"],
  "cta": "texto do botão"
}`,
  }

  return templates[type]
}

// ─── POST /api/creative/generate ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  try {
    const body = await req.json() as {
      type:       GenerateType
      channel?:   Channel
      objective?: Objective
      context?:   string
    }

    const { type, context = '' } = body
    const channel:   Channel   = body.channel   ?? 'general'
    const objective: Objective = body.objective ?? 'promocao'

    // Resolve company from the authenticated session — never trust a
    // client-supplied company_id (it would let any logged-in user
    // generate content branded as another company).
    const db  = getSupabaseServerClient()
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const companyId = ctx.company.id

    const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
    if (overLimit) return overLimit

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Geração de conteúdo indisponível no momento' }, { status: 503 })
    }

    // Load identity
    const identity = await loadIdentity(db, companyId)

    // Generate with Claude
    const client = new Anthropic()
    const t0 = Date.now()

    const isCampaign = type === 'campaign' || type === 'ad_copy' || type === 'landing_section'

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: isCampaign ? 1200 : 600,
      system:     buildSystemPrompt(identity, channel),
      messages: [{
        role:    'user',
        content: buildUserPrompt(type, channel, objective, context, identity),
      }],
    })

    const rawText = (msg.content[0] as { type: string; text: string }).text
    const generationMs = Date.now() - t0

    // Parse JSON if needed
    let result: { text?: string; json?: unknown } = {}
    if (isCampaign || type === 'subject') {
      if (type === 'subject') {
        result = { text: rawText }
      } else {
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          result = { json: jsonMatch ? JSON.parse(jsonMatch[0]) : null, text: rawText }
        } catch {
          result = { text: rawText }
        }
      }
    } else {
      result = { text: rawText }
    }

    // Persist asset
    const { data: asset } = await db
      .from('ai_generated_assets')
      .insert({
        company_id:    companyId,
        type:          type === 'message' || type === 'caption' || type === 'subject' || type === 'ad_copy' || type === 'landing_section' ? 'text' : 'text',
        subtype:       type,
        prompt:        context,
        content:       rawText,
        model_used:    'claude-sonnet-4-6',
        generation_ms: generationMs,
        metadata:      { channel, objective },
      })
      .select('id')
      .single()

    void incrementAiUsage(companyId)
    return NextResponse.json({
      ...result,
      asset_id:       asset?.id,
      generation_ms:  generationMs,
      company_name:   identity.fantasy_name,
    })
  } catch (err) {
    console.error('[creative/generate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
