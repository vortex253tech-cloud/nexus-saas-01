// ─── OpenAI Whisper — audio transcription ────────────────────────────────────
// Transcribes MP3, WAV, M4A audio files using OpenAI's Whisper model.
// Requires OPENAI_API_KEY in environment variables.

import { createReadStream } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface TranscriptionResult {
  text:     string
  duration?: number
  language?: string
}

export async function transcribeAudio(
  buffer:   Buffer,
  filename: string,
  mime:     string,
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      text: '[Transcrição de áudio indisponível — OPENAI_API_KEY não configurada. Configure a variável para ativar esta funcionalidade.]',
    }
  }

  // Whisper accepts files by stream — write to a temp file
  const ext     = filename.split('.').pop() ?? 'mp3'
  const tmpPath = join(tmpdir(), `nexus_audio_${randomUUID()}.${ext}`)

  try {
    await writeFile(tmpPath, buffer)

    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })

    const transcription = await client.audio.transcriptions.create({
      file:     createReadStream(tmpPath),
      model:    'whisper-1',
      language: 'pt',    // hint for Brazilian Portuguese; Whisper auto-detects if wrong
      response_format: 'verbose_json',
    })

    return {
      text:     transcription.text.trim(),
      duration: (transcription as { duration?: number }).duration,
      language: (transcription as { language?: string }).language,
    }
  } finally {
    // Always clean up the temp file
    unlink(tmpPath).catch(() => { /* ignore */ })
  }
}
