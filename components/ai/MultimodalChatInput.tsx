'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Loader2, X, FileText,
  FileSpreadsheet, Music, ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedAttachment {
  id:             string | null
  tempId:         string           // stable local key
  name:           string
  mime:           string
  type_category:  'document' | 'image' | 'audio'
  extracted_text: string | null
  ai_summary?:    string | null
  url?:           string
  previewUrl?:    string
  uploading:      boolean
  error?:         string
}

interface MultimodalChatInputProps {
  value:    string
  onChange: (v: string) => void
  onSend:   (attachments: UploadedAttachment[]) => void
  loading:  boolean
  disabled: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPT_ATTR = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a'

const MAX_SIZE: Record<'document' | 'image' | 'audio', number> = {
  document: 10_000_000,
  image:    5_000_000,
  audio:    25_000_000,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMimeCategory(mime: string): 'document' | 'image' | 'audio' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const cat = getMimeCategory(mime)
  if (cat === 'image') return <ImageIcon size={14} className={className} />
  if (cat === 'audio') return <Music      size={14} className={className} />
  if (mime.includes('sheet') || mime === 'text/csv')
    return <FileSpreadsheet size={14} className={className} />
  return <FileText size={14} className={className} />
}

// ─── Attachment preview chip ──────────────────────────────────────────────────

function AttachmentChip({
  att, onRemove,
}: {
  att:      UploadedAttachment
  onRemove: () => void
}) {
  const isImage = att.type_category === 'image'
  const isAudio = att.type_category === 'audio'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[11px]',
        att.error
          ? 'border-red-500/30 bg-red-500/10 text-red-400'
          : att.uploading
          ? 'border-zinc-700/40 bg-zinc-800/60 text-zinc-500'
          : 'border-zinc-700/40 bg-zinc-800/60 text-zinc-300',
      )}
    >
      {isImage && att.previewUrl ? (
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={att.previewUrl} alt={att.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isAudio ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400',
        )}>
          <FileIcon mime={att.mime} />
        </div>
      )}

      <div className="min-w-0 max-w-[120px]">
        <p className="truncate font-medium leading-tight">{att.name}</p>
        {att.uploading && <p className="text-[9px] text-zinc-500">Enviando…</p>}
        {att.error     && <p className="text-[9px] text-red-400">{att.error}</p>}
        {!att.uploading && !att.error && att.ai_summary && (
          <p className="truncate text-[9px] text-zinc-500">{att.ai_summary}</p>
        )}
      </div>

      {att.uploading && (
        <Loader2 size={11} className="shrink-0 animate-spin text-violet-400" />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 shrink-0 text-zinc-600 transition-colors hover:text-white"
        title="Remover"
      >
        <X size={11} />
      </button>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MultimodalChatInput({
  value, onChange, onSend, loading, disabled,
}: MultimodalChatInputProps) {
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [isDragging,  setIsDragging]  = useState(false)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [value])

  const uploadFile = useCallback(async (file: File) => {
    const tempId   = crypto.randomUUID()
    const category = getMimeCategory(file.type || 'application/octet-stream')

    if (file.size > MAX_SIZE[category]) {
      const mb = Math.round(MAX_SIZE[category] / 1_000_000)
      setAttachments(prev => [...prev, {
        id: null, tempId, name: file.name, mime: file.type, type_category: category,
        extracted_text: null, uploading: false, error: `Arquivo muito grande (máx ${mb} MB)`,
      }])
      return
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined

    setAttachments(prev => [...prev, {
      id: null, tempId, name: file.name,
      mime: file.type || 'application/octet-stream',
      type_category: category, extracted_text: null,
      previewUrl, uploading: true,
    }])

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/upload', { method: 'POST', body: form })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setAttachments(prev => prev.map(a =>
          a.tempId === tempId
            ? { ...a, uploading: false, error: err.error ?? 'Falha no upload' }
            : a,
        ))
        return
      }

      const data = await res.json() as {
        id:             string | null
        name:           string
        mime:           string
        type_category:  'document' | 'image' | 'audio'
        extracted_text: string | null
        ai_summary:     string | null
        url:            string
      }

      setAttachments(prev => prev.map(a =>
        a.tempId === tempId
          ? { ...a, id: data.id, extracted_text: data.extracted_text, ai_summary: data.ai_summary, url: data.url, uploading: false }
          : a,
      ))
    } catch {
      setAttachments(prev => prev.map(a =>
        a.tempId === tempId ? { ...a, uploading: false, error: 'Erro de conexão' } : a,
      ))
    }
  }, [])

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(f => void uploadFile(f))
  }, [uploadFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeAt = useCallback((tempId: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.tempId === tempId)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(a => a.tempId !== tempId)
    })
  }, [])

  const handleSend = useCallback(() => {
    const readyAttachments = attachments.filter(a => !a.uploading && !a.error)
    const hasText = value.trim().length > 0
    const hasAttachment = readyAttachments.length > 0
    if ((!hasText && !hasAttachment) || loading || disabled) return

    onSend(readyAttachments)

    // Clean up preview URLs and clear
    attachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl) })
    setAttachments([])
  }, [value, attachments, loading, disabled, onSend])

  const isUploading = attachments.some(a => a.uploading)
  const canSend     = (value.trim().length > 0 || attachments.some(a => !a.uploading && !a.error))
                      && !loading && !disabled && !isUploading

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-zinc-900/90 transition-all duration-200',
        isDragging
          ? 'border-violet-500/60 ring-2 ring-violet-500/20 shadow-lg shadow-violet-900/20'
          : disabled
          ? 'border-zinc-800 opacity-60'
          : 'border-zinc-700/70 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20',
      )}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900/95 backdrop-blur-sm"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-500/40"
              style={{ boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}
            >
              <Paperclip size={18} className="text-violet-400" />
            </div>
            <p className="text-xs font-medium text-violet-300">Solte aqui para anexar</p>
            <p className="text-[10px] text-zinc-500">PDF, DOCX, XLSX, imagens, áudio</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment previews */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-zinc-800/60 px-3 pb-2 pt-2.5"
          >
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {attachments.map(att => (
                  <AttachmentChip key={att.tempId} att={att} onRemove={() => removeAt(att.tempId)} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || loading}
          title="Anexar arquivo (PDF, DOCX, XLSX, CSV, TXT, imagens, áudio)"
          className={cn(
            'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all',
            'text-zinc-500 hover:bg-zinc-800 hover:text-violet-400',
            (disabled || loading) && 'cursor-not-allowed opacity-40',
          )}
        >
          <Paperclip size={15} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) handleSend()
            }
          }}
          disabled={disabled || loading}
          placeholder={
            disabled    ? 'Carregando…' :
            isUploading ? 'Enviando arquivo…' :
            attachments.length > 0 ? 'Adicione uma pergunta sobre o arquivo…' :
            'Pergunte sobre seus dados ou arraste um arquivo…'
          }
          className="max-h-36 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-white placeholder-zinc-600 outline-none disabled:cursor-not-allowed"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all',
            canSend
              ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40 hover:bg-violet-500 active:scale-95'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600',
          )}
        >
          {loading || isUploading
            ? <Loader2 size={14} className={cn('animate-spin', loading ? 'text-violet-400' : 'text-zinc-500')} />
            : <Send size={14} />
          }
        </button>
      </div>
    </div>
  )
}
