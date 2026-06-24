import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'
import { uploadFile } from '@/lib/storage/upload'

// ─── gpt-image-1 size mapping ─────────────────────────────────────────────────
// OpenAI retired dall-e-3 — gpt-image-1 only supports these 3 sizes (no
// portrait/landscape distinction beyond tall vs wide).

const RATIO_SIZE: Record<string, '1024x1024' | '1024x1536' | '1536x1024'> = {
  square:    '1024x1024',
  portrait:  '1024x1536',
  landscape: '1536x1024',
  banner:    '1536x1024',
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
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

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
    }

    const {
      description = '',
      style       = 'corporate',
      ratio       = 'square',
      objective   = 'promocao',
    } = body

    // Resolve company from the authenticated session — never trust a
    // client-supplied company_id (it would let any logged-in user
    // generate/bill images as another company).
    const db  = getSupabaseServerClient()
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const companyId = ctx.company.id

    // DALL-E 3 is the most expensive AI call in the app — gate before spending
    const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
    if (overLimit) return overLimit

    const companyName = await loadCompanyName(db, companyId)

    const size  = RATIO_SIZE[ratio] ?? '1024x1024'
    const prompt = buildDallePrompt(description, style, objective, companyName)

    const t0     = Date.now()
    const client = new OpenAI({ apiKey })

    const response = await client.images.generate({
      model:   'gpt-image-1',
      prompt,
      n:       1,
      size,
      quality: 'high',
    })

    const items   = response.data ?? []
    const b64     = items[0]?.b64_json
    if (!b64) throw new Error('gpt-image-1 não retornou imagem')

    // gpt-image-1 returns base64 instead of a hosted URL (dall-e-3's old
    // behavior) — upload to the private ai-images bucket and hand back a
    // signed URL, same pattern as every other AI-generated asset.
    const buffer = Buffer.from(b64, 'base64')
    const upload = await uploadFile(buffer, `creative-${Date.now()}.png`, 'image/png', companyId)
    if ('error' in upload) throw new Error(upload.error)
    const imageUrl = upload.url

    const generationMs = Date.now() - t0

    // Persist asset record
    await db.from('ai_generated_assets').insert({
      company_id:    companyId,
      type:          'image',
      subtype:       ratio,
      prompt:        description,
      image_url:     imageUrl,
      model_used:    'gpt-image-1',
      generation_ms: generationMs,
      metadata:      { style, objective, size, storage_path: upload.path, storage_bucket: upload.bucket },
    })

    void incrementAiUsage(companyId)
    return NextResponse.json({
      url:           imageUrl,
      generation_ms: generationMs,
      company_name:  companyName,
      size,
    })
  } catch (err) {
    console.error('[creative/image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
