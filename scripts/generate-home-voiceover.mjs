#!/usr/bin/env node
/**
 * generate-home-voiceover.mjs
 *
 * Generates the long-form NEXUS presentation voiceover (ElevenLabs TTS) used
 * by <VoiceOrb /> on the landing page, and writes it to public/audio/.
 *
 * Reads ELEVENLABS_API_KEY from .env.local without sourcing the file as shell
 * (it contains an unquoted "<" in RESEND_FROM that breaks `source`/bash eval).
 *
 * Usage:
 *   node scripts/generate-home-voiceover.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = resolve(__dir, '..')

function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const env    = loadEnvLocal()
const APIKEY = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY

if (!APIKEY) {
  console.error('❌  ELEVENLABS_API_KEY não encontrado em .env.local')
  process.exit(1)
}

// Yuri — Deep, Imposing and Confident (male, brazilian, pt) — matches the
// "masculina, grave e confiante" brief.
const VOICE_ID = 'WSBwiRQRmi2mEG7BfKwS'

const VOICE_SETTINGS = {
  stability:        0.5,
  similarity_boost: 0.78,
  style:            0.2,
  use_speaker_boost: true,
  speed:            0.92,
}

// ─── Narration — one segment per module, concatenated into one file ─────────
// Kept as separate TTS calls (not one giant request) so each module gets a
// natural breath/pause at the boundary, and to stay well under any per-call
// character cap.

const SEGMENTS = [
  `Toda empresa tem o mesmo problema. Vendas pedindo atenção. Financeiro pedindo decisão. Cliente pedindo resposta. E você, no meio de tudo isso, tentando lembrar o que ainda não fez. E se sua empresa tivesse um sistema operacional próprio? Não um aplicativo. Não um chatbot. Um sistema que pensa, decide e executa, vinte e quatro horas por dia, todos os dias. Isso é o NEXUS.`,

  `O NEXUS não responde perguntas. Ele opera sua empresa. A diferença é simples de entender. Um chatbot espera você perguntar, e então te dá uma resposta. O NEXUS não espera. Ele monitora seu negócio em tempo real, identifica o que precisa de atenção, e age, sem que você precise pedir. Pense nele como o diretor de operações da sua empresa, baseado em inteligência artificial. Alguém que nunca dorme, nunca esquece, e nunca perde uma oportunidade porque estava ocupado demais.`,

  `Vamos pelo começo: como os clientes chegam até você. O NEXUS organiza todo o seu funil de vendas automaticamente. Cada lead que entra, pelo site, por um formulário, por uma conversa de WhatsApp, é classificado por temperatura e prioridade na hora. Você não perde tempo separando quem está pronto para comprar de quem só está pesquisando. O NEXUS já fez essa triagem antes de você abrir o painel.`,

  `E falando em WhatsApp: essa é uma das partes mais poderosas do sistema. O NEXUS conecta diretamente ao WhatsApp da sua empresa e conversa com seus clientes usando inteligência artificial. Ele entende o contexto, extrai informações relevantes, nicho do negócio, dor principal, estágio da conversa, e atualiza o seu CRM sozinho, em tempo real. Se a conversa precisar de um humano, ele transfere com um clique. Se não precisar, ele resolve. Isso significa atendimento ativo o tempo inteiro, mesmo às três da manhã, mesmo num feriado.`,

  `Agora, o dinheiro. O NEXUS acompanha receita, despesas e inadimplência em tempo real, não no fechamento do mês. Ele identifica clientes em atraso automaticamente, e pode disparar cobranças inteligentes sem que você precise lembrar de fazer isso manualmente. Cada relatório que normalmente levaria horas para montar, o NEXUS gera em segundos.`,

  `Aqui é onde o NEXUS realmente se diferencia de qualquer ferramenta que você já usou. Você desenha um fluxo visual, um mapa de crescimento, conectando blocos: análise de dados, decisão, geração de mensagem, ação automática. Recuperar inadimplentes. Reativar clientes que pararam de comprar. Lançar uma campanha completa. Você monta o fluxo uma vez, e o NEXUS executa quantas vezes for necessário, sozinho, monitorando cada etapa em tempo real.`,

  `E quando você precisa criar conteúdo, uma campanha, uma imagem, um documento, o NEXUS também faz isso. Ele gera mensagens em três tons diferentes simultaneamente, para você escolher o que combina com sua marca. Cria imagens para suas campanhas. Monta propostas comerciais, relatórios executivos e contratos completos. Tudo com a identidade da sua empresa, gerado em segundos, sem precisar de designer, copywriter ou agência.`,

  `E se você preferir simplesmente falar? O NEXUS entende comando de voz, em tempo real. Você pergunta qual é o seu faturamento de hoje, pede para gerar um relatório, pede para criar uma tarefa, e ele responde e executa, na hora, como se estivesse conversando com alguém da sua equipe.`,

  `No fim, a diferença entre o NEXUS e qualquer outra ferramenta é essa: ferramenta espera comando. O NEXUS age. Enquanto você dorme, ele está organizando seu pipeline. Enquanto você está em uma reunião, ele está respondendo um cliente. Enquanto você esquece de cobrar uma fatura, ele já cobrou.`,

  `O NEXUS está em fase de lançamento agora. Isso significa três coisas para quem entra hoje: onboarding direto com o time que construiu o sistema, preço de fundador que não sobe nos próximos reajustes, e prioridade nas próximas funcionalidades que forem pedidas. Sete dias grátis. Sem cartão de crédito. Cancele quando quiser. Sua empresa não precisa de mais um aplicativo. Ela precisa de um sistema que opere por você. Esse sistema é o NEXUS.`,
]

async function synthesize(text, index) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'xi-api-key':   APIKEY,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id:       'eleven_multilingual_v2',
      voice_settings: VOICE_SETTINGS,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Segmento ${index + 1} falhou (HTTP ${res.status}): ${body.slice(0, 300)}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  ✓ segmento ${index + 1}/${SEGMENTS.length} — ${buf.length} bytes`)
  return buf
}

async function main() {
  console.log(`Gerando voiceover (${SEGMENTS.length} segmentos, voz Yuri)...`)
  const buffers = []
  for (let i = 0; i < SEGMENTS.length; i++) {
    buffers.push(await synthesize(SEGMENTS[i], i))
  }

  const full = Buffer.concat(buffers)
  const outPath = resolve(ROOT, 'public/audio/nexus-apresentacao.mp3')
  writeFileSync(outPath, full)

  const estSeconds = Math.round((full.length * 8) / 128000)
  const min = Math.floor(estSeconds / 60)
  const sec = estSeconds % 60
  console.log(`\n✅  Salvo em ${outPath}`)
  console.log(`    Tamanho: ${(full.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`    Duração estimada: ${min}m${String(sec).padStart(2, '0')}s`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
