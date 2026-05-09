import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseServerClient } from '@/lib/supabase'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── DALL-E size mapping ──────────────────────────────────────────────────────

const RATIO_SIZE: Record<string, '1024x1024' | '1024x1792' | '1792x1024'> = {
  square:    '1024x1024',
  portrait:  '1024x1792',
  landscape: '1792x1024',
  banner:    '1792x1024',
}

// ─── Load company identity ────────────────────────────────────────────────────

async function loadCompanyName(
  db: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
): Promise<string> {
  const { data: identity } = await db
    .from('company_identity')
    .select('fantasy_name, niche, primary_color')
    .eq('company_id', companyId)
    .maybeSingle()

  if (identity?.fantasy_name) return identity.fantasy_name

  const { data: company } = await db
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  return company?.name ?? 'Minha Empresa'
}

// ─── Build DALL-E prompt ──────────────────────────────────────────────────────

function buildDallePrompt(
  description: string,
  style:       string,
  objective:   string,
  companyName: string,
): string {
  const styleMap: Record<string, string> = {
    corporate: 'professional corporate style, clean design, business aesthetic, modern color palette',
    vibrant:   'vibrant bold colors, energetic design, eye-catching visual, high contrast',
    minimal:   'minimalist design, lots of white space, elegant typography layout, clean lines',
    luxury:    'luxury premium aesthetic, elegant dark tones, gold accents, sophisticated design',
  }

  const objectiveMap: Record<string, string> = {
    cobranca:    'payment reminder, financial, urgent but professional tone',
    reativacao:  'reactivation offer, special deal, welcoming atmosphere',
    lancamento:  'product launch, exciting, new, innovative',
    promocao:    'promotional sale, discount, festive atmosphere',
    boas_vindas: 'welcome, warm, friendly, inviting',
    follow_up:   'follow-up, reconnecting, professional',
  }

  const styleDesc   = styleMap[style]   ?? styleMap.corporate
  const objectDesc  = objectiveMap[objective] ?? ''

  return [
    `Marketing visual for "${companyName}" brand.`,
    description ? `Subject: ${description}.` : '',
    `Style: ${styleDesc}.`,
    objectDesc ? `Mood: ${objectDesc}.` : '',
    'No text, no letters, no words in the image.',
    'High quality, professional marketing image suitable for business.',
  ].filter(Boolean).join(' ')
}

// ─── POST /api/creative/image ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const body = await req.json() as {
      description?: string
      style?:       string
      ratio?:       string
      objective?:   string
      company_id?:  string
    }

    const {
      description = '',
      style       = 'corporate',
      ratio       = 'square',
      objective   = 'promocao',
    } = body

    const db = getSupabaseServerClient()
    let companyId = body.company_id ?? null
    if (!companyId) {
      try { companyId = await resolveCompanyId() } catch { /* ok */ }
    }

    const companyName = companyId
      ? await loadCompanyName(db, companyId)
      : 'Minha Empresa'

    const size  = RATIO_SIZE[ratio] ?? '1024x1024'
    const prompt = buildDallePrompt(description, style, objective, companyName)

    const t0     = Date.now()
    const client = new OpenAI({ apiKey })

    const response = await client.images.generate({
      model:   'dall-e-3',
      prompt,
      n:       1,
      size,
      quality: 'standard',
      style:   style === 'minimal' || style === 'corporate' ? 'natural' : 'vivid',
    })

    const items        = response.data ?? []
    const imageUrl     = items[0]?.url
    const revisedPrompt = items[0]?.revised_prompt ?? null
    if (!imageUrl) throw new Error('DALL-E não retornou imagem')

    const generationMs = Date.now() - t0

    // Persist asset record
    if (companyId) {
      await db.from('ai_generated_assets').insert({
        company_id:    companyId,
        type:          'image',
        subtype:       ratio,
        prompt:        description,
        image_url:     imageUrl,
        model_used:    'dall-e-3',
        generation_ms: generationMs,
        metadata:      { style, objective, size, revised_prompt: revisedPrompt },
      })
    }

    return NextResponse.json({
      url:            imageUrl,
      revised_prompt: revisedPrompt,
      generation_ms:  generationMs,
      company_name:   companyName,
      size,
    })
  } catch (err) {
    console.error('[creative/image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
