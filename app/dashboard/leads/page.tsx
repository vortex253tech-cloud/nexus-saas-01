'use client'

import {
  useState, useEffect, useCallback, useRef, type ChangeEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, Download, Upload, RefreshCw, Loader2,
  X, ChevronDown, Trash2, Mail, Phone, CheckCircle2,
  AlertCircle, ArrowUpRight, FileText, Zap, Filter,
  MoreHorizontal, Check,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost'

interface Lead {
  id:           string
  name:         string
  email:        string | null
  phone:        string | null
  source:       string | null
  notes:        string | null
  status:       LeadStatus
  converted_at: string | null
  created_at:   string
}

interface Meta {
  total:           number
  new:             number
  contacted:       number
  converted:       number
  lost:            number
  conversion_rate: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; dot: string }> = {
  new:       { label: 'Novo',       color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/25',    dot: 'bg-blue-400' },
  contacted: { label: 'Contatado',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25',  dot: 'bg-amber-400' },
  converted: { label: 'Convertido', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400' },
  lost:      { label: 'Perdido',    color: 'text-zinc-500',    bg: 'bg-zinc-800 border-zinc-700',          dot: 'bg-zinc-500' },
}

const ALL_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'lost']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', cfg.bg, cfg.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
      <p className="mb-1 text-[11px] text-zinc-500">{label}</p>
      <p className={cn('text-2xl font-black text-white', accent)}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  )
}

// ─── Status dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange,
}: {
  current: LeadStatus
  onChange: (s: LeadStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1"
      >
        <StatusBadge status={current} />
        <ChevronDown size={12} className="text-zinc-500" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-xl"
          >
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-zinc-800',
                    cfg.color,
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                  {cfg.label}
                  {current === s && <Check size={11} className="ml-auto" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Create lead modal ────────────────────────────────────────────────────────

function CreateLeadModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string
  onClose: () => void
  onCreated: (lead: Lead) => void
}) {
  const [form, setForm]       = useState({ name: '', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function set(key: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leads/manage', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: companyId, ...form }),
      })
      const json = await res.json() as { data?: Lead; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Erro')
      onCreated(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-bold text-white">Novo Lead</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-xs text-red-300">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Nome *</label>
            <input
              autoFocus
              required
              value={form.name}
              onChange={set('name')}
              placeholder="João Silva"
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">E-mail</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="joao@email.com"
                  className="w-full rounded-xl border border-zinc-700/80 bg-zinc-800/60 py-2.5 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Telefone</label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-zinc-700/80 bg-zinc-800/60 py-2.5 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Observações</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Contexto, interesse, como conheceu…"
              className="w-full resize-none rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : 'Criar lead'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Import modal ─────────────────────────────────────────────────────────────

const SAMPLE_CSV = `name,email,phone,notes
Maria Souza,maria@email.com,(11) 98888-7777,Interesse no produto A
Carlos Lima,carlos@empresa.com.br,(21) 97777-6666,Veio pelo Instagram`

function ImportModal({
  companyId,
  onClose,
  onImported,
}: {
  companyId: string
  onClose: () => void
  onImported: (count: number) => void
}) {
  const [csv, setCsv]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCsv((ev.target?.result as string) ?? '')
    reader.readAsText(file, 'UTF-8')
  }

  async function submit() {
    if (!csv.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/leads/manage/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: companyId, csv }),
      })
      const json = await res.json() as { imported: number; skipped: number; errors: string[] }
      setResult(json)
      if (json.imported > 0) onImported(json.imported)
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ['Erro de conexão'] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-bold text-white">Importar Leads</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Instructions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
            <p className="mb-2 text-xs font-semibold text-zinc-300">Formato CSV esperado:</p>
            <p className="mb-2 text-[11px] text-zinc-500">
              Colunas aceitas: <code className="rounded bg-zinc-700 px-1 text-violet-300">name</code>,{' '}
              <code className="rounded bg-zinc-700 px-1 text-violet-300">email</code>,{' '}
              <code className="rounded bg-zinc-700 px-1 text-violet-300">phone</code>,{' '}
              <code className="rounded bg-zinc-700 px-1 text-violet-300">notes</code>.
              Somente <strong className="text-white">name</strong> é obrigatório.
            </p>
            <pre className="overflow-x-auto text-[10px] text-zinc-400">{SAMPLE_CSV}</pre>
          </div>

          {/* File picker */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <FileText size={13} />
              Carregar arquivo .csv
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            {csv && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Arquivo carregado</span>}
          </div>

          {/* Textarea */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Ou cole o CSV aqui:
            </label>
            <textarea
              value={csv}
              onChange={e => setCsv(e.target.value)}
              rows={7}
              placeholder={SAMPLE_CSV}
              className="w-full resize-none rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-3 py-2.5 font-mono text-xs text-white placeholder-zinc-700 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-xl border p-3 text-xs',
              result.imported > 0
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300',
            )}>
              <p className="font-semibold">{result.imported} leads importados, {result.skipped} pulados.</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] opacity-80">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              {result ? 'Fechar' : 'Cancelar'}
            </button>
            {!result && (
              <button
                onClick={submit}
                disabled={loading || !csv.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Importando…</> : 'Importar leads'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  companyId,
  onStatusChange,
  onDelete,
}: {
  lead: Lead
  companyId: string
  onStatusChange: (id: string, status: LeadStatus) => void
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleStatusChange(newStatus: LeadStatus) {
    // Optimistic
    onStatusChange(lead.id, newStatus)
    await fetch(`/api/leads/manage/${lead.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company_id: companyId, status: newStatus }),
    })
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/leads/manage/${lead.id}?company_id=${companyId}`, { method: 'DELETE' })
      onDelete(lead.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group border-b border-zinc-800/50 transition hover:bg-zinc-800/20"
    >
      <td className="py-3 pl-4 pr-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">{lead.name}</span>
          {lead.notes && <span className="mt-0.5 text-[11px] text-zinc-600 line-clamp-1">{lead.notes}</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          {lead.email && (
            <a href={`mailto:${lead.email}`}
               className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-violet-400">
              <Mail size={11} />{lead.email}
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`}
               className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-violet-400">
              <Phone size={11} />{lead.phone}
            </a>
          )}
          {!lead.email && !lead.phone && <span className="text-xs text-zinc-700">—</span>}
        </div>
      </td>
      <td className="hidden px-3 py-3 sm:table-cell">
        <span className="rounded-full border border-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-500">
          {lead.source ?? 'manual'}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusDropdown current={lead.status} onChange={handleStatusChange} />
      </td>
      <td className="hidden px-3 py-3 text-xs text-zinc-500 lg:table-cell">
        {fmtDate(lead.created_at)}
      </td>
      <td className="py-3 pl-3 pr-4">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
          title="Excluir lead"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </td>
    </motion.tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads,     setLeads]     = useState<Lead[]>([])
  const [meta,      setMeta]      = useState<Meta | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<LeadStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    void resolveCompanyId().then(cid => setCompanyId(cid))
  }, [])

  const fetchLeads = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ company_id: companyId })
      if (filter !== 'all') params.set('status', filter)
      if (search)           params.set('q', search)
      const res  = await fetch(`/api/leads/manage?${params}`)
      const json = await res.json() as { data: Lead[]; meta: Meta }
      setLeads(json.data ?? [])
      setMeta(json.meta  ?? null)
    } finally {
      setLoading(false)
    }
  }, [companyId, filter, search])

  useEffect(() => {
    if (companyId) void fetchLeads()
  }, [companyId, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { if (companyId) void fetchLeads() }, 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(id: string, status: LeadStatus) {
    setLeads(p => p.map(l => l.id === id ? { ...l, status } : l))
  }

  function handleDelete(id: string) {
    setLeads(p => p.filter(l => l.id !== id))
    setMeta(p => p ? { ...p, total: p.total - 1 } : p)
  }

  function handleCreated(lead: Lead) {
    setLeads(p => [lead, ...p])
    setMeta(p => p ? { ...p, total: p.total + 1, new: p.new + 1 } : p)
    setShowCreate(false)
  }

  function exportCsv() {
    if (!leads.length) return
    const header = 'name,email,phone,status,source,notes,created_at'
    const rows   = leads.map(l =>
      [l.name, l.email ?? '', l.phone ?? '', l.status, l.source ?? '', l.notes ?? '', l.created_at]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TAB_FILTERS: Array<{ key: LeadStatus | 'all'; label: string }> = [
    { key: 'all',       label: 'Todos' },
    { key: 'new',       label: 'Novos' },
    { key: 'contacted', label: 'Contatados' },
    { key: 'converted', label: 'Convertidos' },
    { key: 'lost',      label: 'Perdidos' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 pb-16">

      {/* ── Top bar ── */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/95 px-5 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 ring-1 ring-violet-500/20">
              <UserPlus size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Leads</h1>
              <p className="text-[10px] text-zinc-500">Capture e gerencie seus leads</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={exportCsv}
              disabled={!leads.length}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            >
              <Download size={12} />
              Exportar
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <Upload size={12} />
              Importar
            </button>
            <button
              onClick={() => setShowCreate(true)}
              disabled={!companyId}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              <UserPlus size={12} />
              Novo lead
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">

        {/* ── Stats ── */}
        {meta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            <StatCard label="Total" value={meta.total} />
            <StatCard label="Novos" value={meta.new} accent="text-blue-400" />
            <StatCard label="Contatados" value={meta.contacted} accent="text-amber-400" />
            <StatCard label="Convertidos" value={meta.converted} accent="text-emerald-400" />
            <StatCard
              label="Taxa de conversão"
              value={`${meta.conversion_rate}%`}
              sub={`${meta.converted} de ${meta.total}`}
              accent={meta.conversion_rate >= 20 ? 'text-emerald-400' : 'text-zinc-300'}
            />
          </motion.div>
        )}

        {/* ── Filter tabs + search ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-1">
            {TAB_FILTERS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  filter === t.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-white',
                )}
              >
                {t.label}
                {t.key !== 'all' && meta && (
                  <span className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                    filter === t.key ? 'bg-white/20' : 'bg-zinc-700 text-zinc-400',
                  )}>
                    {t.key === 'new' ? meta.new :
                     t.key === 'contacted' ? meta.contacted :
                     t.key === 'converted' ? meta.converted : meta.lost}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone…"
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/50 py-2 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 sm:w-72"
            />
          </div>
        </div>

        {/* ── Flow integration callout ── */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-violet-800/30 bg-violet-950/20 px-4 py-3"
        >
          <Zap size={14} className="shrink-0 text-violet-400" />
          <p className="text-xs text-zinc-400">
            Leads estão disponíveis no <strong className="text-white">Flow Engine</strong> — use as fontes{' '}
            <code className="rounded bg-zinc-800 px-1 text-violet-300">leads</code> ou{' '}
            <code className="rounded bg-zinc-800 px-1 text-violet-300">new_leads</code> em análises,
            e as ações <code className="rounded bg-zinc-800 px-1 text-violet-300">CREATE_LEAD</code>{' '}
            e <code className="rounded bg-zinc-800 px-1 text-violet-300">UPDATE_LEAD_STATUS</code> para automatizar.
          </p>
          <ArrowUpRight size={12} className="shrink-0 text-zinc-600" />
        </motion.div>

        {/* ── Table ── */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800/60">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60 bg-zinc-900/80">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Lead</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Contato</th>
                <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">Origem</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">Criado em</th>
                <th className="py-3 pl-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Loader2 size={24} className="mx-auto animate-spin text-violet-400" />
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <UserPlus size={32} className="mx-auto mb-3 text-zinc-700" />
                      <p className="text-sm text-zinc-500">
                        {search || filter !== 'all'
                          ? 'Nenhum lead encontrado para este filtro.'
                          : 'Nenhum lead ainda. Crie seu primeiro lead ou importe uma lista.'}
                      </p>
                      {!search && filter === 'all' && (
                        <button
                          onClick={() => setShowCreate(true)}
                          className="mt-4 rounded-xl bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-400 transition hover:bg-violet-600/30"
                        >
                          Criar primeiro lead
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  companyId && leads.map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      companyId={companyId}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>

          {leads.length > 0 && (
            <div className="border-t border-zinc-800/60 bg-zinc-900/30 px-4 py-2 text-right text-[11px] text-zinc-600">
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
              {filter !== 'all' && ` · filtro: ${STATUS_CONFIG[filter as LeadStatus]?.label}`}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showCreate && companyId && (
          <CreateLeadModal
            key="create"
            companyId={companyId}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
        {showImport && companyId && (
          <ImportModal
            key="import"
            companyId={companyId}
            onClose={() => setShowImport(false)}
            onImported={count => {
              void fetchLeads()
              setShowImport(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
