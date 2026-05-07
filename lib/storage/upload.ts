// ─── Supabase Storage — file upload service ──────────────────────────────────
// Handles upload, signed URLs, and validation for the AI multimodal engine.
// Buckets must be created via supabase/migrations/20260507_ai_multimodal.sql

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// ─── MIME → bucket mapping ────────────────────────────────────────────────────

const BUCKET_FOR_MIME: Record<string, string> = {
  'application/pdf': 'ai-files',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'ai-files',
  'application/vnd.ms-excel': 'ai-files',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ai-files',
  'text/csv': 'ai-files',
  'text/plain': 'ai-files',
  'image/png':  'ai-images',
  'image/jpeg': 'ai-images',
  'image/jpg':  'ai-images',
  'image/webp': 'ai-images',
  'image/gif':  'ai-images',
  'audio/mpeg': 'ai-audio',
  'audio/wav':  'ai-audio',
  'audio/wave': 'ai-audio',
  'audio/x-wav': 'ai-audio',
  'audio/mp4':  'ai-audio',
  'audio/x-m4a': 'ai-audio',
  'audio/m4a':  'ai-audio',
  'audio/ogg':  'ai-audio',
}

// Extension fallback for cases where MIME is generic
const EXT_TO_MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.csv':  'text/csv',
  '.txt':  'text/plain',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.m4a':  'audio/x-m4a',
}

const ALLOWED_MIMES = new Set(Object.keys(BUCKET_FOR_MIME))

const SIZE_LIMITS: Record<string, number> = {
  'ai-files':  10 * 1024 * 1024,  // 10 MB
  'ai-images':  5 * 1024 * 1024,  //  5 MB
  'ai-audio':  25 * 1024 * 1024,  // 25 MB
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  path:   string
  bucket: string
  url:    string   // signed URL valid for 24 h
}

export interface ValidationError {
  error: string
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function validateMimeType(
  mime: string,
  filename: string,
): { valid: boolean; resolvedMime: string; error?: string } {
  let resolvedMime = mime

  // Browsers sometimes report generic MIME for known types — fall back to extension
  if (!ALLOWED_MIMES.has(mime)) {
    const ext = ('.' + filename.split('.').pop()!.toLowerCase()) as keyof typeof EXT_TO_MIME
    resolvedMime = EXT_TO_MIME[ext] ?? mime
  }

  if (!ALLOWED_MIMES.has(resolvedMime)) {
    return {
      valid: false,
      resolvedMime,
      error: `Tipo de arquivo não suportado: ${mime}. Use PDF, DOCX, XLSX, CSV, TXT, imagens ou áudio.`,
    }
  }

  return { valid: true, resolvedMime }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(
  buffer:   Buffer | Uint8Array,
  filename: string,
  mime:     string,
  companyId: string,
): Promise<UploadResult | ValidationError> {
  const { valid, resolvedMime, error: mimeError } = validateMimeType(mime, filename)
  if (!valid) return { error: mimeError! }

  const bucket = BUCKET_FOR_MIME[resolvedMime]!
  const limit  = SIZE_LIMITS[bucket]!

  if (buffer.byteLength > limit) {
    const mb = (limit / 1024 / 1024).toFixed(0)
    return { error: `Arquivo muito grande. Limite: ${mb} MB.` }
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const path     = `${companyId}/${Date.now()}_${safeName}`
  const supabase = getAdminClient()

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: resolvedMime,
      upsert:      false,
    })

  if (upErr) return { error: `Upload falhou: ${upErr.message}` }

  // Signed URL valid 24 hours
  const { data: signed, error: urlErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 86400)

  if (urlErr || !signed?.signedUrl) {
    return { error: `Falha ao gerar URL: ${urlErr?.message}` }
  }

  return { path, bucket, url: signed.signedUrl }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = getAdminClient()
  await supabase.storage.from(bucket).remove([path])
}

// ─── Get fresh signed URL ─────────────────────────────────────────────────────

export async function getSignedUrl(
  bucket: string,
  path:   string,
  expiresIn = 3600,
): Promise<string | null> {
  const supabase = getAdminClient()
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}
