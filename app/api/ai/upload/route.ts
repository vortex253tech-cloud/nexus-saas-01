// POST /api/ai/upload — unified multimodal file upload + extraction
// Accepts multipart/form-data with one file per request.
// Returns: { id, name, mime, bucket, path, url, extracted_text, type_category }

export const runtime = 'nodejs'   // pdf-parse and mammoth require Node.js
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { uploadFile } from '@/lib/storage/upload'
import { extractDocumentText } from '@/lib/ai/processors'
import { analyzeImage } from '@/lib/ai/vision/analyze-image'
import { transcribeAudio } from '@/lib/ai/audio/transcribe'
import { denyIfCannot, denyIfAtLimit } from '@/lib/plan-middleware'
import { getAiUsage, incrementAiUsage } from '@/lib/usage'

type MimeCategory = 'document' | 'image' | 'audio'

function getMimeCategory(mime: string): MimeCategory {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  }

  const { companyId, authId } = auth

  // Image/audio analysis costs an AI call; plain document parsing is local (no LLM)
  const denied = await denyIfCannot('nexus_ai')
  if (denied) return denied

  // ── 2. Parse multipart form ───────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Payload inválido. Envie multipart/form-data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Nenhum arquivo encontrado no campo "file".' }, { status: 400 })
  }

  const mime     = file.type || 'application/octet-stream'
  const filename = file.name
  const buffer   = Buffer.from(await file.arrayBuffer())

  // ── 3. Upload to Supabase Storage ─────────────────────────────────────────────
  const uploadResult = await uploadFile(buffer, filename, mime, companyId)

  if ('error' in uploadResult) {
    return NextResponse.json({ error: uploadResult.error }, { status: 422 })
  }

  const { path, bucket, url } = uploadResult
  const category = getMimeCategory(mime)

  // ── 4. Extract / analyze content ──────────────────────────────────────────────
  let extractedText: string | null = null
  let aiSummary:     string | null = null

  try {
    if (category === 'document') {
      const doc = await extractDocumentText(buffer, mime, filename)
      extractedText = doc.text || null

      // Build a compact summary header for the AI context block
      const meta: string[] = [`Arquivo: ${filename}`]
      if (doc.pages)   meta.push(`Páginas: ${doc.pages}`)
      if (doc.sheets)  meta.push(`Planilhas: ${doc.sheets.join(', ')}`)
      if (doc.rows)    meta.push(`Linhas: ${doc.rows}`)
      if (doc.warning) meta.push(`⚠️ ${doc.warning}`)
      aiSummary = meta.join(' | ')

    } else if (category === 'image') {
      const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
      if (overLimit) return overLimit

      const imageMime = mime as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
      const analysis  = await analyzeImage(buffer, imageMime)
      extractedText   = analysis.description
      aiSummary       = `Imagem analisada: ${filename}`
      void incrementAiUsage(companyId)

    } else if (category === 'audio') {
      const overLimit = await denyIfAtLimit('max_ai_messages', await getAiUsage(companyId))
      if (overLimit) return overLimit

      const transcription = await transcribeAudio(buffer, filename, mime)
      extractedText       = transcription.text
      const dur = transcription.duration
        ? ` (${Math.round(transcription.duration)}s)`
        : ''
      aiSummary = `Áudio transcrito: ${filename}${dur}`
      void incrementAiUsage(companyId)
    }
  } catch (err) {
    console.error('[upload] extraction error:', err)
    // Don't fail the upload — just return without extracted text
    aiSummary = `Arquivo recebido: ${filename} (extração de texto indisponível)`
  }

  // ── 5. Persist metadata in ai_attachments ─────────────────────────────────────
  const db = getSupabaseServerClient()
  const { data: attachment, error: dbErr } = await db
    .from('ai_attachments')
    .insert({
      company_id:     companyId,
      user_id:        (await db.from('users').select('id').eq('auth_id', authId).maybeSingle()).data?.id ?? null,
      name:           filename,
      mime_type:      mime,
      file_size:      buffer.byteLength,
      bucket,
      storage_path:   path,
      extracted_text: extractedText,
      ai_summary:     aiSummary,
    })
    .select('id')
    .single()

  if (dbErr) {
    console.error('[upload] DB insert error:', dbErr)
    // Non-fatal — still return the file info
  }

  return NextResponse.json({
    id:             attachment?.id ?? null,
    name:           filename,
    mime,
    bucket,
    path,
    url,
    type_category:  category,
    extracted_text: extractedText,
    ai_summary:     aiSummary,
    size:           buffer.byteLength,
  })
}
