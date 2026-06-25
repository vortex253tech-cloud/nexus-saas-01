// ─── Instagram content machine ───────────────────────────────────────────────
// Generates and publishes one organic post per day to @nexus.saas.ia.
// Caption: Claude (Anthropic). Image: gpt-image-1 (OpenAI), uploaded to the
// private ai-images bucket — Instagram only needs to fetch it once, at
// creation time, so a signed URL is enough.
//
// NEVER target any Instagram Business Account other than IG_BUSINESS_ACCOUNT_ID.
// The same Meta app (NEXUS-APP) also has access to an unrelated account
// (Dra. Luiza Campos, 17841459603297145) — that ID must never appear here.

import { readFile } from 'fs/promises'
import path from 'path'
import { getSupabaseServerClient } from '@/lib/supabase'
import { uploadFile } from '@/lib/storage/upload'
import { overlayTitleSubtitle, type CreativeFormat } from '@/lib/image-text-overlay'

const GRAPH = 'https://graph.facebook.com/v21.0'

// ─── Content angles ───────────────────────────────────────────────────────────

// Mirrors respond.io's content pillars (analyzed for structure only — no
// copying of their visuals/copy): produto shows the real interface,
// educativo follows a problem→solução template, lançamento covers real
// product news (never invented features), autoridade is vision/philosophy.
export type AngleCategory = 'produto' | 'educativo' | 'lancamento' | 'autoridade'

export interface CarouselSlide {
  imagePrompt?:    string   // used when screenshotPath is absent
  screenshotPath?: string   // real product screenshot, relative to assets/product-screenshots/
  title: string
  subtitle: string
}

export interface Angle {
  id: string
  name: string
  category: AngleCategory
  format?: 'single' | 'carousel'   // default 'single'
  imagePrompt?:    string          // unused when format === 'carousel' or screenshotPath is set
  screenshotPath?: string          // real product screenshot instead of AI generation
  captionBrief: string
  slides?: CarouselSlide[]         // required when format === 'carousel'
  /** Small pill tag baked into the image, e.g. "NOVIDADE" — for posts de lançamento. */
  launchBadge?: string
}

// Shared photographic style — matches the brand's existing manual-post
// template: a real, confident business professional, dark moody office
// setting, cinematic editorial lighting, subject positioned toward the
// right side of the frame (the left side stays visually quiet so the text
// overlay has room to sit over it). Used for "autoridade" (vision/leadership)
// content, where a person's presence is appropriate.
const PHOTO_STYLE =
  'photorealistic editorial photography, a confident Brazilian business professional in dark business attire, positioned on the right side of the frame, dark moody office or studio background, cinematic low-key lighting, shallow depth of field, shot on a full-frame camera, high-end corporate advertising photography, no text, no words, no letters, no logos'

// Shared style for AI-generated UI/dashboard mockups — used for "educativo"
// and "lancamento" content where no real product screenshot fits the
// specific point being made. Aims for "premium global SaaS company" rather
// than generic stock-photo tech imagery.
const MOCKUP_STYLE =
  'premium product photography of a sleek laptop and smartphone on a minimalist dark desk, both screens displaying a clean modern dark-mode SaaS dashboard UI with glowing teal and violet accent charts and data cards, shallow depth of field, soft cinematic studio lighting, Silicon Valley startup aesthetic, no readable text, no words, no letters, no logos'

async function loadScreenshotBuffer(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(process.cwd(), 'assets', 'product-screenshots', relativePath)
  return readFile(fullPath)
}

export const ANGLES: Angle[] = [
  // ── EDUCATIVO ────────────────────────────────────────────────────────────
  {
    id: 'numeros_crescimento',
    name: 'Números e crescimento',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, the professional looking at a laptop screen with a subtle confident expression, soft blue glow from the screen on their face, modern minimalist office`,
    captionBrief:
      'Ângulo: prova por números/dados. Fale sobre quanto dinheiro/tempo uma empresa sem automação perde, ou quanto pode recuperar, de forma concreta (pode usar uma estimativa percentual plausível, sem inventar estatística de fonte externa). Tom consultivo, não alarmista.',
  },
  {
    id: 'antes_depois',
    name: 'Antes e depois',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, the professional standing arms crossed with a calm relieved expression, clean organized desk barely visible in the dark background, sense of relief and control`,
    captionBrief:
      'Ângulo: transformação antes/depois. Contraste a operação manual e caótica de hoje com a operação automatizada com o NEXUS. Foco na sensação de alívio/clareza, não em medo.',
  },
  {
    id: 'curiosidade',
    name: 'Curiosidade',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, the professional with a thoughtful intrigued half-smile, slightly tilted head, looking just off-camera, dramatic side lighting`,
    captionBrief:
      'Ângulo: gatilho de curiosidade. Abra com uma pergunta genuinamente intrigante sobre a operação da empresa do leitor (não óbvia, não clichê de "você sabia que..."). Convide a descobrir a resposta no diagnóstico gratuito.',
  },
  {
    id: 'vertical_agencias',
    name: 'Específico: agências',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, creative agency studio setting in the soft-focus background, the professional in smart-casual attire, relaxed confident posture`,
    captionBrief:
      'Ângulo: específico para agências de marketing/publicidade. Fale de uma dor real e específica desse nicho (relatório pro cliente, follow-up de proposta, organização de múltiplos clientes) e como o NEXUS resolve.',
  },
  {
    id: 'vertical_clinicas',
    name: 'Específico: clínicas/consultórios',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, the professional dressed as a clinic/healthcare business owner (no medical coat, just smart business attire), soft clinical-modern background blur, warm trustworthy expression`,
    captionBrief:
      'Ângulo: específico para clínicas e consultórios. Fale de uma dor real desse nicho (confirmação de agenda, falta em consulta, cobrança de pacientes) e como o NEXUS resolve.',
  },
  {
    id: 'pergunta_engajamento',
    name: 'Pergunta para engajar',
    category: 'educativo',
    imagePrompt:
      `${PHOTO_STYLE}, the professional with hands slightly open in a questioning gesture, eyebrows raised, engaging direct eye contact with camera`,
    captionBrief:
      'Ângulo: pergunta direta para gerar comentários. Liste 2-3 problemas operacionais comuns (ex: responder clientes, cobrar inadimplentes, organizar dados) e pergunte qual mais atrapalha o dia do leitor — convide a responder nos comentários.',
  },
  {
    id: 'educativo_problema_solucao',
    name: 'Problema → Solução',
    category: 'educativo',
    imagePrompt: MOCKUP_STYLE,
    captionBrief:
      'Ângulo: formato rígido "Problema → Solução". A legenda PRECISA seguir essa estrutura literal: uma linha "Problema: " descrevendo uma dor operacional real e específica (ex: tarefas repetitivas, mensagens perdidas, cobrança manual), seguida de uma linha "Solução: " explicando objetivamente como o NEXUS resolve. Escolha uma dor diferente da dos últimos posts.',
  },

  // ── PRODUTO (protagonismo do produto real) ────────────────────────────────
  {
    id: 'produto_cobranca_recuperada',
    name: 'Produto: cobrança recuperada (screenshot real)',
    category: 'produto',
    screenshotPath: 'automation-recovered.png',
    imagePrompt: '',
    captionBrief:
      'Ângulo: mostrar o produto de verdade. A imagem é um print real do NEXUS recuperando uma fatura em atraso automaticamente (R$2.500, zero intervenção manual). Fale sobre como a cobrança automática funciona de ponta a ponta, sem o dono da empresa precisar cobrar ninguém pessoalmente.',
  },
  {
    id: 'produto_rastreamento_vivo',
    name: 'Produto: rastreamento em tempo real (screenshot real)',
    category: 'produto',
    screenshotPath: 'automation-live.png',
    imagePrompt: '',
    captionBrief:
      'Ângulo: mostrar o produto de verdade. A imagem é um print real do NEXUS rastreando em tempo real o momento em que um cliente inadimplente abre o link de cobrança (dispositivo, localização, horário). Fale sobre a visibilidade em tempo real que isso dá pro dono da empresa, sem precisar perguntar nada ao cliente.',
  },
  {
    id: 'como_funciona_carrossel',
    name: 'Como o NEXUS funciona por dentro (carrossel)',
    category: 'produto',
    format: 'carousel',
    imagePrompt: '',
    captionBrief:
      'Carrossel mostrando o produto real por dentro, passo a passo, em tom de bastidores/transparência.',
    slides: [
      {
        imagePrompt: `${PHOTO_STYLE}, the professional standing confidently with arms crossed, direct eye contact, cover-slide energy`,
        title: 'Como o NEXUS funciona por dentro',
        subtitle: 'O Sistema Operacional Empresarial com IA, em 5 passos',
      },
      {
        imagePrompt: `${PHOTO_STYLE}, the professional looking at their phone with a satisfied expression, as if reading an automatic notification`,
        title: '1. Atendimento automático',
        subtitle: 'A IA responde clientes no WhatsApp 24h, sem perder uma mensagem',
      },
      {
        screenshotPath: 'automation-live.png',
        title: '2. Cobrança em tempo real',
        subtitle: 'Você vê o exato momento em que o cliente abre o link de pagamento',
      },
      {
        screenshotPath: 'automation-recovered.png',
        title: '3. Receita recuperada',
        subtitle: 'R$2.500 cobrados e confirmados, zero intervenção manual',
      },
      {
        imagePrompt: `${PHOTO_STYLE}, the professional glancing at their phone with an alert attentive expression, as if just received a timely notification`,
        title: '4. Decisões em tempo real',
        subtitle: 'Alertas e recomendações no momento certo, antes do problema crescer',
      },
      {
        imagePrompt: `${PHOTO_STYLE}, the professional smiling confidently, arms relaxed, inviting and approachable, closing-slide energy`,
        title: 'Pronto para automatizar?',
        subtitle: 'Diagnóstico gratuito: diagnostico.nexusaas.com.br',
      },
    ],
  },

  // ── LANÇAMENTO (sempre sobre novidades reais, nunca inventadas) ──────────
  {
    id: 'lancamento_whatsapp_ia',
    name: 'Lançamento: WhatsApp com IA treinada',
    category: 'lancamento',
    imagePrompt: MOCKUP_STYLE,
    launchBadge: 'Novidade',
    captionBrief:
      'Ângulo: novidade real — o WhatsApp oficial do NEXUS agora responde com uma IA treinada no produto (planos, preços, diagnóstico gratuito), em vez de respostas genéricas. Anuncie em tom de atualização de produto, convidando quem tem dúvida a mandar mensagem no WhatsApp do NEXUS pra testar.',
  },

  // ── AUTORIDADE (visão/filosofia, honesto, sem prova social inventada) ────
  {
    id: 'autoridade_visao',
    name: 'Autoridade: visão e filosofia',
    category: 'autoridade',
    imagePrompt:
      `${PHOTO_STYLE}, late at night in an empty office with city lights blurred through a window behind, the professional looking relaxed and unburdened, warm desk lamp light`,
    captionBrief:
      'Ângulo: visão/filosofia do NEXUS, tom de fundador. Fale sobre POR QUE o NEXUS existe — a crença de que pequenas empresas não devem precisar de uma equipe grande pra ter a mesma inteligência operacional de uma empresa grande. NÃO use estatísticas de clientes, números de usuários ou depoimentos — o NEXUS ainda está em fase inicial e isso deve ser tratado com honestidade, nunca inventado.',
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

// ─── Caption + title/subtitle generation (Claude) ─────────────────────────────

export interface PostCopy {
  title:    string  // punchy headline baked into the image, max ~6 words
  subtitle: string  // supporting line baked into the image, max ~12 words
  caption:  string  // full Instagram caption
}

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const text = json.content?.[0]?.text?.trim()
  if (!text) throw new Error('Claude não retornou texto')
  return text
}

export async function generatePostCopy(angle: Angle, recentCaptions: string[]): Promise<PostCopy> {
  const avoidBlock = recentCaptions.length
    ? `\n\nLegendas dos últimos posts (NÃO repita a estrutura, abertura ou frases destas):\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''

  const systemPrompt = `Você escreve posts de Instagram para @nexus.saas.ia, conta da NEXUS — um Sistema Operacional Empresarial com IA (CRM, automação de WhatsApp, cobrança, diagnóstico financeiro). Público: donos de pequenas e médias empresas, agências, consultorias, clínicas no Brasil.

Cada post tem 3 partes:
1. "title": frase curta e impactante (até 6 palavras) que vai aparecer GRANDE, sobreposta na própria imagem — precisa chamar atenção e fazer sentido sozinha, sem o resto do texto.
2. "subtitle": linha de apoio (até 12 palavras), também sobreposta na imagem, complementando o título.
3. "caption": a legenda completa do post.

Regras obrigatórias para a "caption":
- Português do Brasil, tom direto e confiante, sem ser sensacionalista.
- Entre 40 e 90 palavras.
- NÃO use fórmula de medo/ameaça repetitiva ("você vai ficar para trás", "enquanto isso seu concorrente...").
- Varie a frase de abertura — nunca comece com "Enquanto você..." ou "Sua empresa...".
- Termine com uma chamada clara para o diagnóstico gratuito em diagnostico.nexusaas.com.br (pode variar a frase do CTA).
- No máximo 4 hashtags relevantes ao final, nunca uma parede de hashtags.
- Não invente números/estatísticas citando fontes externas falsas.

Responda APENAS com um JSON válido, sem markdown, sem comentário, no formato exato:
{"title": "...", "subtitle": "...", "caption": "..."}`

  const userPrompt = `Ângulo de hoje: ${angle.name}\n${angle.captionBrief}${avoidBlock}`

  const text = await callClaude(systemPrompt, userPrompt, 500)

  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(cleaned) as PostCopy
    if (!parsed.title || !parsed.caption) throw new Error('campos faltando')
    return { title: parsed.title, subtitle: parsed.subtitle ?? '', caption: parsed.caption }
  } catch {
    // Fallback: Claude didn't return clean JSON — derive a basic title from
    // the caption's first line rather than failing the whole post.
    const firstLine = text.split('\n')[0].slice(0, 60)
    return { title: firstLine, subtitle: '', caption: text }
  }
}

// ─── Image generation (gpt-image-1) ───────────────────────────────────────────

export async function generateImageBuffer(prompt: string): Promise<Buffer> {
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
      prompt,
      size: '1024x1536', // closest available ratio to the 4:5 final canvas; cropped to fit in overlayTitleSubtitle
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

// Generates (or loads, for real product screenshots) a background then
// overlays the branded title/subtitle/logo layer on top — used for both
// single posts and each carousel slide. slideIndex/slideTotal are omitted
// for single-image posts.
export async function generateImageWithOverlay(opts: {
  prompt?:         string
  screenshotPath?: string
  title:           string
  subtitle:        string
  slideIndex?:     number
  slideTotal?:     number
  format?:         CreativeFormat
  badge?:          string
  ctaLabel?:       string
}): Promise<Buffer> {
  const background = opts.screenshotPath
    ? await loadScreenshotBuffer(opts.screenshotPath)
    : await generateImageBuffer(opts.prompt ?? '')
  return overlayTitleSubtitle(background, {
    title: opts.title, subtitle: opts.subtitle, slideIndex: opts.slideIndex, slideTotal: opts.slideTotal,
    layout: opts.screenshotPath ? 'screenshot' : 'photo',
    format: opts.format, badge: opts.badge, ctaLabel: opts.ctaLabel,
  })
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

// Stories use a one-shot container (media_type: STORIES) — no caption field
// (Instagram Stories don't support a text caption the way feed posts do).
export async function publishStoryToInstagram(imageUrl: string): Promise<PublishResult> {
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUser = process.env.IG_BUSINESS_ACCOUNT_ID
  if (!token || !igUser) throw new Error('INSTAGRAM_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados')
  if (igUser !== '17841456954840976') {
    throw new Error(`IG_BUSINESS_ACCOUNT_ID inesperado (${igUser}) — abortando para não postar na conta errada`)
  }

  const containerRes = await fetch(`${GRAPH}/${igUser}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, media_type: 'STORIES', access_token: token }),
  })
  const containerJson = await containerRes.json()
  if (!containerRes.ok || !containerJson.id) {
    throw new Error(`Falha ao criar container de story: ${JSON.stringify(containerJson)}`)
  }

  const publishRes = await fetch(`${GRAPH}/${igUser}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerJson.id, access_token: token }),
  })
  const publishJson = await publishRes.json()
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(`Falha ao publicar story: ${JSON.stringify(publishJson)}`)
  }

  return { mediaId: publishJson.id, permalink: null }
}

export async function publishCarouselToInstagram(imageUrls: string[], caption: string): Promise<PublishResult> {
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUser = process.env.IG_BUSINESS_ACCOUNT_ID
  if (!token || !igUser) throw new Error('INSTAGRAM_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados')
  if (igUser !== '17841456954840976') {
    throw new Error(`IG_BUSINESS_ACCOUNT_ID inesperado (${igUser}) — abortando para não postar na conta errada`)
  }
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`Carrossel precisa de 2 a 10 imagens, recebeu ${imageUrls.length}`)
  }

  // Step 1: one item container per slide (no caption on items, just the image)
  const childIds: string[] = []
  for (const imageUrl of imageUrls) {
    const itemRes = await fetch(`${GRAPH}/${igUser}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: token }),
    })
    const itemJson = await itemRes.json()
    if (!itemRes.ok || !itemJson.id) {
      throw new Error(`Falha ao criar item do carrossel: ${JSON.stringify(itemJson)}`)
    }
    childIds.push(itemJson.id)
  }

  // Step 2: carousel container referencing all item containers
  const carouselRes = await fetch(`${GRAPH}/${igUser}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption,
      access_token: token,
    }),
  })
  const carouselJson = await carouselRes.json()
  if (!carouselRes.ok || !carouselJson.id) {
    throw new Error(`Falha ao criar container do carrossel: ${JSON.stringify(carouselJson)}`)
  }

  // Step 3: publish
  const publishRes = await fetch(`${GRAPH}/${igUser}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: carouselJson.id, access_token: token }),
  })
  const publishJson = await publishRes.json()
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(`Falha ao publicar carrossel: ${JSON.stringify(publishJson)}`)
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

export async function runDailyInstagramPost(forceAngleId?: string): Promise<{
  angleId: string
  caption: string
  mediaId?: string
  permalink?: string | null
  error?: string
  debug?: string
}> {
  const db = getSupabaseServerClient()
  const angle = forceAngleId ? ANGLES.find(a => a.id === forceAngleId) ?? await pickNextAngle() : await pickNextAngle()

  const { data: recent } = await db
    .from('instagram_posts_log')
    .select('caption')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(3)

  const recentCaptions = (recent ?? []).map(r => r.caption as string)

  let logId: string | null = null
  let debugHex = ''
  try {
    if (angle.format === 'carousel') {
      if (!angle.slides?.length) throw new Error(`Ângulo ${angle.id} é carrossel mas não tem slides`)

      const copy = await generatePostCopy(angle, recentCaptions)

      // Generate all slides concurrently — sequential generation of 6
      // gpt-image-1 calls blew past the function's time limit.
      const slideTotal = angle.slides.length
      const slideResults = await Promise.all(
        angle.slides.map(async (slide, i) => {
          const buffer = await generateImageWithOverlay({
            prompt: slide.imagePrompt, screenshotPath: slide.screenshotPath,
            title: slide.title, subtitle: slide.subtitle, slideIndex: i + 1, slideTotal,
          })
          const upload = await uploadFile(buffer, `ig-carousel-${Date.now()}-${i}.png`, 'image/png', 'platform-instagram')
          if ('error' in upload) throw new Error(upload.error)
          return upload
        }),
      )
      const imagePaths = slideResults.map(u => u.path)
      const imageUrls  = slideResults.map(u => u.url)

      const { data: inserted } = await db
        .from('instagram_posts_log')
        .insert({ angle_id: angle.id, caption: copy.caption, image_path: JSON.stringify(imagePaths), status: 'pending' })
        .select('id')
        .single()
      logId = inserted?.id ?? null

      const { mediaId, permalink } = await publishCarouselToInstagram(imageUrls, copy.caption)

      if (logId) {
        await db.from('instagram_posts_log')
          .update({ ig_media_id: mediaId, permalink, status: 'published' })
          .eq('id', logId)
      }

      return { angleId: angle.id, caption: copy.caption, mediaId, permalink }
    }

    // ── Single-image post ──────────────────────────────────────────────────
    const copy = await generatePostCopy(angle, recentCaptions)
    const imageBuffer = await generateImageWithOverlay({
      prompt: angle.imagePrompt, screenshotPath: angle.screenshotPath, title: copy.title, subtitle: copy.subtitle,
      badge: angle.launchBadge,
    })
    debugHex = `${imageBuffer.subarray(0, 8).toString('hex')} len=${imageBuffer.length}`
    console.log(`[instagram-daily-post] imageBuffer first bytes: ${debugHex}`)

    const upload = await uploadFile(imageBuffer, `ig-post-${Date.now()}.png`, 'image/png', 'platform-instagram')
    if ('error' in upload) throw new Error(upload.error)

    const { data: inserted } = await db
      .from('instagram_posts_log')
      .insert({ angle_id: angle.id, caption: copy.caption, image_path: upload.path, status: 'pending' })
      .select('id')
      .single()
    logId = inserted?.id ?? null

    const { mediaId, permalink } = await publishToInstagram(upload.url, copy.caption)

    if (logId) {
      await db.from('instagram_posts_log')
        .update({ ig_media_id: mediaId, permalink, status: 'published' })
        .eq('id', logId)
    }

    return { angleId: angle.id, caption: copy.caption, mediaId, permalink, debug: debugHex }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (logId) {
      await db.from('instagram_posts_log').update({ status: 'failed', error: message }).eq('id', logId)
    }
    return { angleId: angle.id, caption: '', error: message, debug: debugHex }
  }
}
