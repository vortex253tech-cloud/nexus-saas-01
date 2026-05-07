// ─── Claude Vision — image analysis ──────────────────────────────────────────
// Analyzes uploaded images using Claude's vision capability.
// Extracts text (OCR), detects financial documents, reads dashboards.

import Anthropic from '@anthropic-ai/sdk'

export interface ImageAnalysis {
  description: string   // full analysis returned to the user
  ocr_text?:   string   // extracted text if any
  doc_type?:   string   // 'invoice' | 'boleto' | 'dashboard' | 'chart' | 'general'
}

const VISION_PROMPT = `Você é um especialista em análise visual financeira e empresarial.

Analise esta imagem e:
1. Descreva o que está na imagem de forma clara e detalhada
2. Se houver texto, extraia todo o texto visível (OCR)
3. Se for um boleto, nota fiscal, DRE, relatório ou planilha — extraia TODOS os valores
4. Se for um dashboard ou gráfico — interprete os dados e identifique tendências
5. Se for uma tabela — transcreva os dados em formato estruturado
6. Identifique valores financeiros, datas, nomes, CNPJ/CPF quando presentes
7. Forneça insights práticos sobre o que os dados revelam

Responda em português. Seja preciso e completo.`

export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType:    'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  userQuestion?: string,
): Promise<ImageAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      description: 'Análise de imagem indisponível (ANTHROPIC_API_KEY não configurada).',
    }
  }

  const ai = new Anthropic({ apiKey })
  const base64 = imageBuffer.toString('base64')

  const prompt = userQuestion
    ? `${VISION_PROMPT}\n\nQuestão específica do usuário: ${userQuestion}`
    : VISION_PROMPT

  try {
    const res = await ai.messages.create({
      model:      'claude-opus-4-7',  // Use the most capable model for vision
      max_tokens: 1500,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: {
              type:       'base64',
              media_type: mimeType,
              data:        base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      }],
    })

    const description = res.content[0]?.type === 'text'
      ? res.content[0].text.trim()
      : 'Não foi possível analisar a imagem.'

    return { description }
  } catch (err) {
    console.error('[vision] Claude error:', err)
    return {
      description: `Erro na análise da imagem: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
    }
  }
}
