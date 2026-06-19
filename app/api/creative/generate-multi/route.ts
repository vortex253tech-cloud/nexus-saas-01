// POST /api/creative/generate-multi
// Generates 3 content variations in parallel with different tones.
// Wraps the existing /api/creative/generate logic with concurrent Claude calls.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                     from '@anthropic-ai/sdk'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getAuthContext }            from '@/lib/auth'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

type GenerateType = 'message' | 'campaign' | 'subject' | 'caption' | 'ad_copy' | 'landing_section'
type Channel      = 'whatsapp' | 'email' | 'instagram' | 'sms' | 'general'
type Objective    = 'cobranca' | 'reativacao' | 'lancamento' | 'promocao' | 'boas_vindas' | 'follow_up'
type Tone         = 'premium' | 'emocional' | 'persuasivo' | 'urgente' | 'amigavel' | 'corporativo'

interface CompanyIdentity {
  fantasy_name:  string
  slogan:        string | null
  ai_name:       string
  ai_role:       string
  ai_style:      string
  niche:         string | null
  primary_color: string | null
  tone_keywords: string[]
}

export interface Variation {
  tone:      Tone
  tone_label: string
  text:      string
  asset_id?: string
}

// ─── Load identity ────────────────────────────────────────────────────────────

async function loadIdentity(companyId: string): Promise<CompanyIdentity> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('company_identity')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (data) return data as CompanyIdentity

  const { data: company } = await db
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  return {
    fantasy_name:  (company as { name?: string } | null)?.name ?? 'Minha Empresa',
    slogan:        null,
    ai_name:       'Assistente',
    ai_role:       'Assistente de atendimento',
    ai_style:      'amigavel',
    niche:         null,
    primary_color: null,
    tone_keywords: [],
  }
}

async function resolveCompanyId(): Promise<string | null> {
  try {
    const ctx = await getAuthContext()
    if (ctx?.companyId) return ctx.companyId
  } catch { /* ok */ }
  try {
    const db = getSupabaseServerClient()
    const { data } = await db.from('companies').select('id').limit(1).single()
    if (data?.id) return data.id as string
  } catch { /* ok */ }
  return null
}

// ─── Tone definitions ─────────────────────────────────────────────────────────

const TONES: Array<{ tone: Tone; label: string; instruction: string }> = [
  {
    tone:        'persuasivo',
    label:       'Persuasivo',
    instruction: 'Tom persuasivo e direto. Use gatilhos mentais (escassez, prova social, autoridade). CTA forte. Máximo impacto em poucas palavras.',
  },
  {
    tone:        'emocional',
    label:       'Emocional',
    instruction: 'Tom caloroso e empático. Conecte-se com a emoção do cliente. Fale sobre transformação, conquistas, sonhos. Humanizado e próximo.',
  },
  {
    tone:        'urgente',
    label:       'Urgente',
    instruction: 'Tom urgente e direto. Crie senso de urgência real (prazo, vagas limitadas, oportunidade única). Linguagem de ação imediata.',
  },
]

// ─── Build prompt ─────────────────────────────────────────────────────────────

function buildPrompt(
  type:      GenerateType,
  channel:   Channel,
  objective: Objective,
  context:   string,
  identity:  CompanyIdentity,
  toneInstr: string,
): { system: string; user: string } {
  const objectiveMap: Record<Objective, string> = {
    cobranca:    'cobrança de pagamento em atraso',
    reativacao:  'reativação de cliente inativo com oferta especial',
    lancamento:  'lançamento de produto ou serviço novo',
    promocao:    'promoção e desconto especial',
    boas_vindas: 'boas-vindas a novo cliente',
    follow_up:   'follow-up e reconexão com o cliente',
  }

  const system = `Você é especialista em copywriting para a empresa "${identity.fantasy_name}".
${identity.niche ? `Nicho: ${identity.niche}.` : ''}
${identity.slogan ? `Slogan: "${identity.slogan}".` : ''}
Tom de voz da marca: ${identity.ai_style}.

REGRAS ABSOLUTAS:
- NUNCA mencione "NEXUS", "IA" ou qualquer plataforma de tecnologia
- NUNCA revele que foi gerado por IA
- USE o nome "${identity.fantasy_name}" como remetente
- Escreva em português do Brasil
- ${toneInstr}`

  const typeInstructions: Record<GenerateType, string> = {
    message: `Crie UMA mensagem de ${channel} para ${objectiveMap[objective]}.
${context ? `Contexto: ${context}` : ''}
${channel === 'whatsapp' ? 'Máximo 3 parágrafos. Use emojis moderadamente.' : ''}
${channel === 'email' ? 'Tom profissional. 3-4 parágrafos. Include CTA claro.' : ''}
${channel === 'instagram' ? 'Include 5-8 hashtags relevantes no final.' : ''}
Retorne APENAS o texto final, sem títulos ou explicações.`,
    campaign: `Crie UMA campanha de ${channel} para ${objectiveMap[objective]}.
Retorne apenas o texto principal da campanha.`,
    subject: `Crie UM assunto de email para ${objectiveMap[objective]}.
40-60 caracteres. Máximo impacto. Sem numeração.`,
    caption: `Crie UMA legenda para Instagram sobre ${objectiveMap[objective]}.
Gancho forte, corpo (2-3 parágrafos), CTA claro, 5-8 hashtags.`,
    ad_copy: `Crie UM texto de anúncio para ${channel} sobre ${objectiveMap[objective]}.
Headline curto + texto principal persuasivo.`,
    landing_section: `Crie UMA seção de landing page sobre ${objectiveMap[objective]}.
Headline + subtítulo + texto curto.`,
  }

  return { system, user: typeInstructions[type] }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const body = await req.json() as {
      type:        GenerateType
      channel?:    Channel
      objective?:  Objective
      context?:    string
      company_id?: string
    }

    const { type, context = '' } = body
    const channel:   Channel   = body.channel   ?? 'whatsapp'
    const objective: Objective = body.objective ?? 'promocao'

    let companyId = body.company_id ?? null
    if (!companyId) companyId = await resolveCompanyId()
    if (!companyId) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 })
    }

    // 3 tones = 3 LLM calls — check there's room for at least one before spending
    const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
    if (overLimit) return overLimit

    const identity = await loadIdentity(companyId)
    const client   = new Anthropic({ apiKey })
    const t0       = Date.now()

    // Generate 3 variations in parallel
    const variations = await Promise.all(
      TONES.map(async ({ tone, label, instruction }) => {
        const { system, user } = buildPrompt(type, channel, objective, context, identity, instruction)

        const msg = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system,
          messages: [{ role: 'user', content: user }],
        })

        const text = (msg.content[0] as { type: string; text: string }).text.trim()
        return { tone, tone_label: label, text } satisfies Variation
      }),
    )

    const generationMs = Date.now() - t0

    // Persist all three as assets
    const db = getSupabaseServerClient()
    await Promise.all(
      variations.map(v =>
        db.from('ai_generated_assets').insert({
          company_id:    companyId,
          type:          'text',
          subtype:       type,
          prompt:        context,
          content:       v.text,
          model_used:    'claude-haiku-4-5-20251001',
          generation_ms: generationMs,
          metadata:      { channel, objective, tone: v.tone },
        }),
      ),
    )

    void incrementAiUsage(companyId, variations.length)
    return NextResponse.json({
      variations,
      generation_ms: generationMs,
      company_name:  identity.fantasy_name,
    })
  } catch (err) {
    console.error('[creative/generate-multi]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
