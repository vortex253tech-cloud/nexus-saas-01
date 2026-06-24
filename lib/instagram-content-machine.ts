// ─── Instagram content machine ───────────────────────────────────────────────
// Generates and publishes one organic post per day to @nexus.saas.ia.
// Caption: Claude (Anthropic). Image: gpt-image-1 (OpenAI), uploaded to the
// private ai-images bucket — Instagram only needs to fetch it once, at
// creation time, so a signed URL is enough.
//
// NEVER target any Instagram Business Account other than IG_BUSINESS_ACCOUNT_ID.
// The same Meta app (NEXUS-APP) also has access to an unrelated account
// (Dra. Luiza Campos, 17841459603297145) — that ID must never appear here.

import { getSupabaseServerClient } from '@/lib/supabase'
import { uploadFile } from '@/lib/storage/upload'

const GRAPH = 'https://graph.facebook.com/v21.0'

// ─── Content angles ───────────────────────────────────────────────────────────

export interface Angle {
  id: string
  name: string
  imagePrompt: string
  captionBrief: string
}

export const ANGLES: Angle[] = [
  {
    id: 'numeros_crescimento',
    name: 'Números e crescimento',
    imagePrompt:
      'A sleek dark navy blue dashboard interface floating in dark space, glowing gold and blue data charts and metrics rising upward, abstract financial growth visualization, premium SaaS product aesthetic, deep navy background, gold accent glow, minimalist, professional, no text, no words, no letters, no numbers',
    captionBrief:
      'Ângulo: prova por números/dados. Fale sobre quanto dinheiro/tempo uma empresa sem automação perde, ou quanto pode recuperar, de forma concreta (pode usar uma estimativa percentual plausível, sem inventar estatística de fonte externa). Tom consultivo, não alarmista.',
  },
  {
    id: 'antes_depois',
    name: 'Antes e depois',
    imagePrompt:
      'Split composition advertising image, left half shows a chaotic cluttered desk with papers flying, red notification dots, stressed dim red lighting, right half shows the same desk completely clean and minimal with a single calm glowing navy blue and gold holographic dashboard floating above it, dark background, premium tech advertising photography, cinematic lighting, no text, no words, no letters',
    captionBrief:
      'Ângulo: transformação antes/depois. Contraste a operação manual e caótica de hoje com a operação automatizada com o NEXUS. Foco na sensação de alívio/clareza, não em medo.',
  },
  {
    id: 'curiosidade',
    name: 'Curiosidade',
    imagePrompt:
      'Minimalist premium advertising image, a single glowing gold question mark made of light particles floating in deep navy blue dark space, abstract data points and subtle grid lines in the background, mysterious and intriguing mood, high-end SaaS brand aesthetic, no text, no words, no letters',
    captionBrief:
      'Ângulo: gatilho de curiosidade. Abra com uma pergunta genuinamente intrigante sobre a operação da empresa do leitor (não óbvia, não clichê de "você sabia que..."). Convide a descobrir a resposta no diagnóstico gratuito.',
  },
  {
    id: 'valor_direto',
    name: 'Valor direto',
    imagePrompt:
      'A modern smartphone floating in dark navy space displaying a clean futuristic business dashboard app interface with gold and blue accents, chat bubbles and checkmarks subtly glowing around it representing automated customer responses, premium product advertising photography, soft cinematic lighting, no readable text, no words, no letters',
    captionBrief:
      'Ângulo: valor direto, sem medo nem dor. Descreva objetivamente o que o NEXUS faz (responde clientes, cobra inadimplentes, identifica perdas) em tom confiante e direto, sem fórmula de "você vai ficar para trás".',
  },
  {
    id: 'bastidores_ia',
    name: 'Bastidores da IA',
    imagePrompt:
      'Atmospheric night scene, a glowing navy blue and gold holographic AI orb working silently on a desk in a dark empty office at night, city lights blurred through a window in the background, sense of quiet continuous activity, premium cinematic tech photography, no text, no words, no letters',
    captionBrief:
      'Ângulo: "um dia (ou uma madrugada) na vida do NEXUS". Narre, de forma simples e concreta, o que a IA está fazendo enquanto o dono da empresa não está olhando (respondendo cliente, cobrando, organizando dados). Tom mais pessoal e narrativo.',
  },
  {
    id: 'vertical_agencias',
    name: 'Específico: agências',
    imagePrompt:
      'Abstract premium image representing a creative marketing agency workflow, glowing navy blue and gold geometric shapes forming a pipeline or flow diagram, clean dark background, sophisticated tech aesthetic, no text, no words, no letters',
    captionBrief:
      'Ângulo: específico para agências de marketing/publicidade. Fale de uma dor real e específica desse nicho (relatório pro cliente, follow-up de proposta, organização de múltiplos clientes) e como o NEXUS resolve.',
  },
  {
    id: 'vertical_clinicas',
    name: 'Específico: clínicas/consultórios',
    imagePrompt:
      'Abstract premium image representing a modern healthcare clinic management system, glowing navy blue and gold calendar and checkmark icons softly floating, clean dark minimalist background, sophisticated tech aesthetic, no text, no words, no letters',
    captionBrief:
      'Ângulo: específico para clínicas e consultórios. Fale de uma dor real desse nicho (confirmação de agenda, falta em consulta, cobrança de pacientes) e como o NEXUS resolve.',
  },
  {
    id: 'pergunta_engajamento',
    name: 'Pergunta para engajar',
    imagePrompt:
      'Minimalist premium advertising image, three glowing gold abstract icons representing different business problems (a clock, a chat bubble, a falling arrow) floating in dark navy space, clean composition, sophisticated tech aesthetic, no text, no words, no letters',
    captionBrief:
      'Ângulo: pergunta direta para gerar comentários. Liste 2-3 problemas operacionais comuns (ex: responder clientes, cobrar inadimplentes, organizar dados) e pergunte qual mais atrapalha o dia do leitor — convide a responder nos comentários.',
  },
]

// ─── Pick least-recently-used angle ───────────────────────────────────────────

export async function pickNextAngle(): Promise<Angle> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('instagram_posts_log')
    .select('angle_id, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(ANGLES.length)

  const lastUsedOrder = (data ?? []).map(r => r.angle_id as string)

  // Angle never used yet → highest priority. Otherwise, the one furthest
  // back in lastUsedOrder (or absent from it) goes first.
  const scored = ANGLES.map(angle => {
    const idx = lastUsedOrder.indexOf(angle.id)
    return { angle, recency: idx === -1 ? Infinity : ANGLES.length - idx }
  })

  scored.sort((a, b) => b.recency - a.recency)
  return scored[0].angle
}

// ─── Caption generation (Claude) ──────────────────────────────────────────────

export async function generateCaption(angle: Angle, recentCaptions: string[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const avoidBlock = recentCaptions.length
    ? `\n\nLegendas dos últimos posts (NÃO repita a estrutura, abertura ou frases destas):\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''

  const systemPrompt = `Você escreve legendas de Instagram para @nexus.saas.ia, conta da NEXUS — um Sistema Operacional Empresarial com IA (CRM, automação de WhatsApp, cobrança, diagnóstico financeiro). Público: donos de pequenas e médias empresas, agências, consultorias, clínicas no Brasil.

Regras obrigatórias:
- Português do Brasil, tom direto e confiante, sem ser sensacionalista.
- Entre 40 e 90 palavras.
- NÃO use fórmula de medo/ameaça repetitiva ("você vai ficar para trás", "enquanto isso seu concorrente...").
- Varie a frase de abertura — nunca comece com "Enquanto você..." ou "Sua empresa...".
- Termine com uma chamada clara para o diagnóstico gratuito em diagnostico.nexusaas.com.br (pode variar a frase do CTA).
- No máximo 4 hashtags relevantes ao final, nunca uma parede de hashtags.
- Não invente números/estatísticas citando fontes externas falsas.
- Retorne APENAS o texto da legenda, sem aspas, sem comentário extra.`

  const userPrompt = `Ângulo de hoje: ${angle.name}\n${angle.captionBrief}${avoidBlock}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const text = json.content?.[0]?.text?.trim()
  if (!text) throw new Error('Claude não retornou legenda')
  return text
}

// ─── Image generation (gpt-image-1) ───────────────────────────────────────────

export async function generateImageBuffer(angle: Angle): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada')

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: angle.imagePrompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI image API error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('gpt-image-1 não retornou imagem')
  return Buffer.from(b64, 'base64')
}

// ─── Publish to Instagram ──────────────────────────────────────────────────────

export interface PublishResult {
  mediaId: string
  permalink: string | null
}

export async function publishToInstagram(imageUrl: string, caption: string): Promise<PublishResult> {
  const token   = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUser  = process.env.IG_BUSINESS_ACCOUNT_ID
  if (!token || !igUser) throw new Error('INSTAGRAM_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados')
  if (igUser !== '17841456954840976') {
    throw new Error(`IG_BUSINESS_ACCOUNT_ID inesperado (${igUser}) — abortando para não postar na conta errada`)
  }

  const containerRes = await fetch(`${GRAPH}/${igUser}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  })
  const containerJson = await containerRes.json()
  if (!containerRes.ok || !containerJson.id) {
    throw new Error(`Falha ao criar container: ${JSON.stringify(containerJson)}`)
  }

  const publishRes = await fetch(`${GRAPH}/${igUser}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerJson.id, access_token: token }),
  })
  const publishJson = await publishRes.json()
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(`Falha ao publicar: ${JSON.stringify(publishJson)}`)
  }

  let permalink: string | null = null
  try {
    const permRes = await fetch(`${GRAPH}/${publishJson.id}?fields=permalink&access_token=${token}`)
    const permJson = await permRes.json()
    permalink = permJson.permalink ?? null
  } catch {
    // non-critical
  }

  return { mediaId: publishJson.id, permalink }
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

export async function runDailyInstagramPost(): Promise<{
  angleId: string
  caption: string
  mediaId?: string
  permalink?: string | null
  error?: string
}> {
  const db = getSupabaseServerClient()
  const angle = await pickNextAngle()

  const { data: recent } = await db
    .from('instagram_posts_log')
    .select('caption')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(3)

  const recentCaptions = (recent ?? []).map(r => r.caption as string)

  let logId: string | null = null
  try {
    const caption = await generateCaption(angle, recentCaptions)
    const imageBuffer = await generateImageBuffer(angle)

    const upload = await uploadFile(imageBuffer, `ig-post-${Date.now()}.png`, 'image/png', 'platform-instagram')
    if ('error' in upload) throw new Error(upload.error)

    const { data: inserted } = await db
      .from('instagram_posts_log')
      .insert({ angle_id: angle.id, caption, image_path: upload.path, status: 'pending' })
      .select('id')
      .single()
    logId = inserted?.id ?? null

    const { mediaId, permalink } = await publishToInstagram(upload.url, caption)

    if (logId) {
      await db.from('instagram_posts_log')
        .update({ ig_media_id: mediaId, permalink, status: 'published' })
        .eq('id', logId)
    }

    return { angleId: angle.id, caption, mediaId, permalink }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (logId) {
      await db.from('instagram_posts_log').update({ status: 'failed', error: message }).eq('id', logId)
    }
    return { angleId: angle.id, caption: '', error: message }
  }
}
