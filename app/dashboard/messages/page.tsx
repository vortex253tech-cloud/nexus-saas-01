'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Mail, Plus, Play, ToggleLeft, ToggleRight, Loader2,
  Trash2, FileText, History, Zap, Sparkles,
  CheckCircle2, AlertCircle, Clock, Users, Settings2,
  Copy, ArrowRight, Edit2, X, Wand2, MessageSquare,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'flows' | 'recommended' | 'templates' | 'history'

interface Flow {
  id:               string
  name:             string
  description:      string
  trigger_type:     'manual' | 'new_client' | 'client_overdue'
  status:           'active' | 'inactive' | 'draft'
  step_count:       number
  enrollment_count: number
  created_at:       string
}

interface MessageTemplate {
  id:         string
  name:       string
  type:       'email' | 'whatsapp'
  category:   'financial' | 'sales' | 'relationship' | 'custom'
  subject:    string
  content:    string
  is_default: boolean
  created_at: string
}

interface MessageLog {
  id:            string
  client_name:   string | null
  channel:       'email' | 'whatsapp'
  to_address:    string
  subject:       string | null
  status:        'sent' | 'failed' | 'simulated'
  sent_at:       string
  error_message: string | null
}

// ─── Template form ────────────────────────────────────────────────────────────

interface TemplateForm {
  name:     string
  type:     'email' | 'whatsapp'
  category: 'financial' | 'sales' | 'relationship' | 'custom'
  subject:  string
  content:  string
}

const EMPTY_FORM: TemplateForm = {
  name:     '',
  type:     'email',
  category: 'custom',
  subject:  '',
  content:  '',
}

const VARIABLES = [
  { label: '{{nome}}',            hint: 'Nome do cliente' },
  { label: '{{empresa}}',         hint: 'Nome da empresa' },
  { label: '{{valor}}',           hint: 'Valor monetário' },
  { label: '{{vencimento}}',      hint: 'Data de vencimento' },
  { label: '{{produto}}',         hint: 'Produto/serviço' },
  { label: '{{link_pagamento}}',  hint: 'Link de pagamento' },
]

// ─── Static recommended flows ─────────────────────────────────────────────────

const RECOMMENDED = [
  {
    id: 'rec-cobranca',
    icon: '💸',
    name: 'Cobrança Automática',
    description: '3 e-mails escalonados para clientes inadimplentes (D+1, D+3, D+7)',
    trigger: 'client_overdue' as const,
    tag: 'Financeiro',
    tagColor: 'text-red-400 bg-red-500/10 border-red-500/30',
    steps: [
      { delay_days: 1, subject: 'Lembrete de pagamento — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Identificamos um pagamento em aberto de <strong>{{valor}}</strong>. Poderia verificar para nós?</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 3, subject: '⚠️ Pagamento vencido — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seu pagamento de <strong>{{valor}}</strong> está vencido. Por favor, regularize sua situação.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 7, subject: '🚨 Urgente: pagamento em atraso — {{empresa}}', body_html: '<p>Prezado(a) <strong>{{nome}}</strong>,</p><p>Seu pagamento de <strong>{{valor}}</strong> está em atraso há mais de uma semana. Por favor, entre em contato conosco imediatamente.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
  {
    id: 'rec-boas-vindas',
    icon: '👋',
    name: 'Sequência de Boas-Vindas',
    description: 'Recepciona novos clientes com mensagens calorosas (D+0, D+3)',
    trigger: 'new_client' as const,
    tag: 'Relacionamento',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    steps: [
      { delay_days: 0, subject: 'Bem-vindo(a) à {{empresa}}! 🎉', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) como nosso cliente.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 3, subject: 'Como está sendo sua experiência? — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Já passaram alguns dias desde o seu início conosco. Como está sendo sua experiência?</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
  {
    id: 'rec-reativacao',
    icon: '🔄',
    name: 'Reativação de Clientes',
    description: 'Recupera clientes inativos com 2 mensagens estratégicas',
    trigger: 'manual' as const,
    tag: 'Vendas',
    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    steps: [
      { delay_days: 0, subject: 'Sentimos sua falta — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Faz algum tempo que não nos falamos! Queremos saber como você está.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 7, subject: 'Oferta especial para você — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Temos uma proposta exclusiva para nossos clientes especiais. Entre em contato conosco!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
  {
    id: 'rec-pos-compra',
    icon: '🎉',
    name: 'Sequência Pós-Compra',
    description: 'Agradece e nutre o cliente logo após uma compra (D+0, D+7)',
    trigger: 'new_client' as const,
    tag: 'Vendas',
    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    steps: [
      { delay_days: 0, subject: 'Obrigado pela sua compra! — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Recebemos seu pedido com sucesso! Obrigado pela confiança.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 7, subject: 'Como foi sua experiência? — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Passada uma semana, gostaríamos de saber como foi sua experiência.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
  {
    id: 'rec-vencimento',
    icon: '📅',
    name: 'Lembrete de Vencimento',
    description: 'Avisa clientes sobre pagamentos próximos ao vencimento (D-3, D-1)',
    trigger: 'manual' as const,
    tag: 'Financeiro',
    tagColor: 'text-red-400 bg-red-500/10 border-red-500/30',
    steps: [
      { delay_days: 0, subject: 'Seu pagamento vence em 3 dias — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Só um lembrete: seu pagamento de <strong>{{valor}}</strong> vence em 3 dias.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 2, subject: 'Último dia: pagamento vence amanhã — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Lembrete final: seu pagamento de <strong>{{valor}}</strong> vence amanhã. Não esqueça!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
  {
    id: 'rec-nutricao',
    icon: '💡',
    name: 'Nutrição de Lead',
    description: 'Educa e engaja leads em potencial com conteúdo de valor (D+0, D+5, D+12)',
    trigger: 'new_client' as const,
    tag: 'Relacionamento',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    steps: [
      { delay_days: 0, subject: 'Uma dica especial para você — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Preparamos um conteúdo exclusivo para ajudá-lo(a) a alcançar seus objetivos!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 5, subject: 'Como está indo? Mais uma dica — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Esperamos que esteja gostando dos nossos conteúdos! Aqui vai mais uma dica.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
      { delay_days: 12, subject: 'Pronto para o próximo nível? — {{empresa}}', body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Você tem acompanhado nossos conteúdos e queremos ir além. Vamos conversar?</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
    ],
  },
]

const TRIGGER_INFO: Record<string, { label: string; color: string }> = {
  manual:         { label: 'Manual',       color: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
  new_client:     { label: 'Novo cliente', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  client_overdue: { label: 'Inadimplente', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
}

const CATEGORY_INFO = {
  financial:    { label: '💰 Financeiro',     color: 'text-amber-400  bg-amber-500/10  border-amber-500/30' },
  sales:        { label: '🛒 Vendas',         color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  relationship: { label: '❤️ Relacionamento', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  custom:       { label: '✏️ Personalizado',  color: 'text-zinc-400   bg-zinc-800      border-zinc-700' },
} as const

// ─── Template modal ───────────────────────────────────────────────────────────

function TemplateModal({
  editingId,
  initialForm,
  onClose,
  onSaved,
}: {
  editingId:   string | null
  initialForm: TemplateForm
  onClose:     () => void
  onSaved:     () => void
}) {
  const [form, setForm]       = useState<TemplateForm>(initialForm)
  const [saving, setSaving]   = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiOpen, setAiOpen]   = useState(false)
  const textareaRef            = useRef<HTMLTextAreaElement>(null)

  function insertVariable(v: string) {
    const el = textareaRef.current
    if (!el) { setForm(f => ({ ...f, content: f.content + v })); return }
    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = form.content.slice(0, start) + v + form.content.slice(end)
    setForm(f => ({ ...f, content: next }))
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return
    setGenerating(true)
    try {
      const res  = await fetch('/api/messages/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: aiPrompt, type: form.type }),
      })
      const data = await res.json() as { subject?: string; content?: string; error?: string }
      if (res.ok && data.content) {
        setForm(f => ({
          ...f,
          content: data.content!,
          ...(data.subject ? { subject: data.subject } : {}),
        }))
        setAiOpen(false)
        setAiPrompt('')
      }
    } finally { setGenerating(false) }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const url    = editingId ? `/api/messages/templates/${editingId}` : '/api/messages/templates'
      const method = editingId ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (res.ok) onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-violet-400" />
            <h2 className="text-sm font-bold text-white">
              {editingId ? 'Editar template' : 'Criar template'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Nome do template</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Cobrança gentil D+0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
            />
          </div>

          {/* Type + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Canal</label>
              <div className="flex gap-2">
                {(['email', 'whatsapp'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors',
                      form.type === t
                        ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                        : 'border-zinc-700 text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {t === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                    {t === 'email' ? 'E-mail' : 'WhatsApp'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Categoria</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as TemplateForm['category'] }))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="financial">💰 Financeiro</option>
                <option value="sales">🛒 Vendas</option>
                <option value="relationship">❤️ Relacionamento</option>
                <option value="custom">✏️ Personalizado</option>
              </select>
            </div>
          </div>

          {/* Subject (email only) */}
          {form.type === 'email' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Assunto</label>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Ex: Lembrete: pagamento em aberto — {{empresa}}"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
            </div>
          )}

          {/* Variables */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 mb-2">Variáveis disponíveis</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v.label}
                  title={v.hint}
                  onClick={() => insertVariable(v.label)}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-[10px] text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/10 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Generate */}
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 overflow-hidden">
            <button
              onClick={() => setAiOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wand2 size={12} className="text-violet-400" />
                <span className="font-medium">Gerar com IA</span>
              </span>
              <ChevronDown size={12} className={cn('transition-transform', aiOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {aiOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 flex gap-2 border-t border-zinc-700/50 pt-3">
                    <input
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && void handleGenerate()}
                      placeholder={`Ex: cobrança amigável para cliente com ${form.type === 'email' ? '3' : '1'} dias de atraso`}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={() => void handleGenerate()}
                      disabled={!aiPrompt.trim() || generating}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {generating ? 'Gerando...' : 'Gerar'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Conteúdo {form.type === 'email' ? '(HTML)' : '(texto)'}
            </label>
            <textarea
              ref={textareaRef}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={8}
              placeholder={form.type === 'email'
                ? '<p>Olá <strong>{{nome}}</strong>,</p>\n<p>Seu pagamento de...</p>'
                : 'Olá {{nome}}, seu pagamento de {{valor}}...'}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !form.name.trim() || !form.content.trim()}
            className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar template'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [tab, setTab]         = useState<Tab>('flows')

  // flows
  const [flows, setFlows]     = useState<Flow[]>([])
  const [loadingFlows, setLoadingFlows] = useState(true)
  const [toggling, setToggling]         = useState<Set<string>>(new Set())
  const [deleting, setDeleting]         = useState<Set<string>>(new Set())
  const [activating, setActivating]     = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling]       = useState<Set<string>>(new Set())

  // templates
  const [templates, setTemplates]       = useState<MessageTemplate[]>([])
  const [loadingTpl, setLoadingTpl]     = useState(false)
  const [deletingTpl, setDeletingTpl]   = useState<string | null>(null)
  const [templateFilter, setTemplateFilter] = useState<'all' | 'financial' | 'sales' | 'relationship' | 'custom'>('all')
  const [modal, setModal]               = useState<{ editingId: string | null; form: TemplateForm } | null>(null)
  const [seeding, setSeeding]           = useState(false)

  // history
  const [logs, setLogs]                 = useState<MessageLog[]>([])
  const [loadingLogs, setLoadingLogs]   = useState(false)

  // toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadFlows = useCallback(async () => {
    setLoadingFlows(true)
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json() as { automations?: Flow[] } | Flow[]
        // Handle both response shapes
        setFlows(Array.isArray(data) ? data : (data.automations ?? []))
      }
    } catch { /* ok */ } finally { setLoadingFlows(false) }
  }, [])

  const loadTemplates = useCallback(async () => {
    setLoadingTpl(true)
    try {
      const res = await fetch('/api/messages/templates')
      if (res.ok) {
        const data = await res.json() as { templates: MessageTemplate[] }
        setTemplates(data.templates ?? [])
      }
    } catch { /* ok */ } finally { setLoadingTpl(false) }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/messages/history?limit=100')
      if (res.ok) {
        const data = await res.json() as { logs: MessageLog[] }
        setLogs(data.logs ?? [])
      }
    } catch { /* ok */ } finally { setLoadingLogs(false) }
  }, [])

  useEffect(() => { void loadFlows() }, [loadFlows])

  useEffect(() => {
    if (tab === 'templates') void loadTemplates()
    if (tab === 'history')   void loadLogs()
  }, [tab, loadTemplates, loadLogs])

  // ── Flows ──────────────────────────────────────────────────────────────────
  async function handleToggle(id: string) {
    setToggling(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/automations/${id}/toggle`, { method: 'POST' })
      await loadFlows()
    } finally { setToggling(prev => { const s = new Set(prev); s.delete(id); return s }) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir este fluxo? Esta ação não pode ser desfeita.')) return
    setDeleting(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/automations/${id}`, { method: 'DELETE' })
      setFlows(prev => prev.filter(f => f.id !== id))
      showToast('Fluxo excluído')
    } finally { setDeleting(prev => { const s = new Set(prev); s.delete(id); return s }) }
  }

  async function handleEnroll(id: string) {
    setEnrolling(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/automations/${id}/enroll`, { method: 'POST' })
      const j = await res.json() as { enrolled?: number }
      showToast(`${j.enrolled ?? 0} cliente(s) adicionado(s) ao fluxo`)
    } catch { showToast('Erro ao disparar fluxo', 'err') }
    finally { setEnrolling(prev => { const s = new Set(prev); s.delete(id); return s }) }
  }

  async function handleActivateRecommended(rec: typeof RECOMMENDED[0]) {
    setActivating(prev => new Set(prev).add(rec.id))
    try {
      const res = await fetch('/api/automations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: rec.name, description: rec.description, trigger_type: rec.trigger, steps: rec.steps }),
      })
      if (res.ok) {
        const { id } = await res.json() as { id: string }
        await fetch(`/api/automations/${id}/toggle`, { method: 'POST' })
        showToast(`"${rec.name}" ativado com sucesso!`)
        await loadFlows()
        setTab('flows')
      }
    } catch { showToast('Erro ao ativar fluxo', 'err') }
    finally { setActivating(prev => { const s = new Set(prev); s.delete(rec.id); return s }) }
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('Excluir este template?')) return
    setDeletingTpl(id)
    try {
      const res = await fetch(`/api/messages/templates/${id}`, { method: 'DELETE' })
      if (res.ok) { setTemplates(prev => prev.filter(t => t.id !== id)); showToast('Template excluído') }
      else showToast('Erro ao excluir template', 'err')
    } finally { setDeletingTpl(null) }
  }

  async function handleSeedTemplates() {
    setSeeding(true)
    try {
      const res = await fetch('/api/messages/templates/seed', { method: 'POST' })
      const data = await res.json() as { created?: number }
      showToast(data.created ? `${data.created} templates importados!` : 'Templates já existem')
      await loadTemplates()
    } finally { setSeeding(false) }
  }

  function handleUseTemplate(t: MessageTemplate) {
    window.location.href = `/dashboard/messages/builder/new?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.content)}`
  }

  const filteredTemplates = templateFilter === 'all'
    ? templates
    : templates.filter(t => t.category === templateFilter)

  // ── Tabs config ────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'flows'       as Tab, label: 'Meus Fluxos',  icon: Zap },
    { id: 'recommended' as Tab, label: 'Recomendados', icon: Sparkles },
    { id: 'templates'   as Tab, label: 'Templates',    icon: FileText },
    { id: 'history'     as Tab, label: 'Histórico',    icon: History },
  ]

  return (
    <div className="min-h-screen p-6 lg:p-8">

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal && (
          <TemplateModal
            editingId={modal.editingId}
            initialForm={modal.form}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); void loadTemplates(); showToast(modal.editingId ? 'Template atualizado!' : 'Template criado!') }}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={cn(
              'fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl',
              toast.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                : 'border-red-500/40 bg-red-950 text-red-300',
            )}
          >
            {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/30 p-2">
              <Mail size={20} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Mensagens</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Automatize comunicações — cobrança, boas-vindas, reativação e muito mais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal({ editingId: null, form: EMPTY_FORM })}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <FileText size={14} /> Criar template
          </button>
          <Link
            href="/dashboard/messages/builder/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-900/30"
          >
            <Plus size={15} /> Criar fluxo
          </Link>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loadingFlows && flows.length > 0 && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Fluxos ativos',     value: flows.filter(f => f.status === 'active').length,          color: 'text-emerald-400' },
            { label: 'Clientes em fluxo', value: flows.reduce((a, f) => a + f.enrollment_count, 0),        color: 'text-violet-400' },
            { label: 'Total de passos',   value: flows.reduce((a, f) => a + f.step_count, 0),              color: 'text-blue-400' },
            { label: 'Total de fluxos',   value: flows.length,                                             color: 'text-zinc-300' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* ══ Tab: Flows ══════════════════════════════════════════════════════════ */}
      {tab === 'flows' && (
        <div>
          {loadingFlows ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : flows.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Zap size={24} className="text-violet-400" />
              </div>
              <p className="text-white font-semibold mb-1">Nenhum fluxo criado ainda</p>
              <p className="text-zinc-500 text-sm mb-5">Crie seu primeiro fluxo ou ative um dos nossos recomendados.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link href="/dashboard/messages/builder/new"
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                  <Plus size={14} /> Criar fluxo
                </Link>
                <button onClick={() => setTab('recommended')}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
                  <Sparkles size={14} /> Ver recomendados
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {flows.map(flow => {
                const trigger = TRIGGER_INFO[flow.trigger_type] ?? TRIGGER_INFO.manual
                return (
                  <motion.div key={flow.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full mt-1.5 shrink-0',
                          flow.status === 'active' ? 'bg-emerald-400' :
                          flow.status === 'draft'  ? 'bg-amber-400'   : 'bg-zinc-600'
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-white">{flow.name}</p>
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', trigger.color)}>
                              {trigger.label}
                            </span>
                          </div>
                          {flow.description && (
                            <p className="text-xs text-zinc-500 mb-2 truncate max-w-md">{flow.description}</p>
                          )}
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                              <Mail size={9} /> {flow.step_count} passo{flow.step_count !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                              <Users size={9} /> {flow.enrollment_count} cliente{flow.enrollment_count !== 1 ? 's' : ''} no fluxo
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => void handleEnroll(flow.id)} disabled={enrolling.has(flow.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-50 transition-colors">
                          {enrolling.has(flow.id) ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                          Disparar
                        </button>
                        <Link href={`/dashboard/messages/builder/${flow.id}`}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors">
                          <Settings2 size={11} /> Editar
                        </Link>
                        <button onClick={() => void handleToggle(flow.id)} disabled={toggling.has(flow.id)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            flow.status === 'active'
                              ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/30 hover:bg-emerald-500/15'
                              : 'text-zinc-500 bg-zinc-800 border-zinc-700 hover:text-white hover:border-zinc-600',
                          )}>
                          {toggling.has(flow.id)
                            ? <Loader2 size={11} className="animate-spin" />
                            : flow.status === 'active' ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
                          {flow.status === 'active' ? 'Ativo' : 'Inativo'}
                        </button>
                        <button onClick={() => void handleDelete(flow.id)} disabled={deleting.has(flow.id)}
                          className="rounded-lg p-1.5 text-zinc-700 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors">
                          {deleting.has(flow.id) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Tab: Recommended ════════════════════════════════════════════════════ */}
      {tab === 'recommended' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED.map(rec => {
            const isActivating = activating.has(rec.id)
            const alreadyExists = flows.some(f => f.name === rec.name)
            return (
              <motion.div key={rec.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{rec.icon}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', rec.tagColor)}>
                      {rec.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{rec.name}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{rec.description}</p>
                </div>
                <div className="space-y-1.5">
                  {rec.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                        {i + 1}
                      </div>
                      <span className="text-[10px] text-zinc-600 flex-1 truncate">
                        D+{step.delay_days} — {step.subject}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => void handleActivateRecommended(rec)}
                  disabled={isActivating || alreadyExists}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all',
                    alreadyExists
                      ? 'border border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-900/20',
                  )}>
                  {isActivating
                    ? <><Loader2 size={13} className="animate-spin" /> Ativando...</>
                    : alreadyExists
                    ? <><CheckCircle2 size={13} /> Já ativado</>
                    : <><Zap size={13} /> Ativar com 1 clique</>}
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ══ Tab: Templates ══════════════════════════════════════════════════════ */}
      {tab === 'templates' && (
        <div>
          {/* Filter + actions bar */}
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'all',          label: '🗂 Todos' },
                { id: 'financial',    label: '💰 Financeiro' },
                { id: 'sales',        label: '🛒 Vendas' },
                { id: 'relationship', label: '❤️ Relacionamento' },
                { id: 'custom',       label: '✏️ Personalizado' },
              ] as Array<{ id: typeof templateFilter; label: string }>).map(f => (
                <button
                  key={f.id}
                  onClick={() => setTemplateFilter(f.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    templateFilter === f.id
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setModal({ editingId: null, form: EMPTY_FORM })}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-bold text-white transition-colors"
            >
              <Plus size={12} /> Criar template
            </button>
          </div>

          {loadingTpl ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
              <FileText size={36} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-white font-semibold mb-1">Nenhum template criado</p>
              <p className="text-zinc-500 text-sm mb-5">
                Crie um template personalizado ou importe os modelos padrão.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setModal({ editingId: null, form: EMPTY_FORM })}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                >
                  <Plus size={14} /> Criar template
                </button>
                <button
                  onClick={() => void handleSeedTemplates()}
                  disabled={seeding}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {seeding ? 'Importando...' : 'Importar modelos padrão'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map(t => {
                const catInfo = CATEGORY_INFO[t.category] ?? CATEGORY_INFO.custom
                return (
                  <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', catInfo.color)}>
                          {catInfo.label}
                        </span>
                        <span className={cn(
                          'flex items-center gap-1 text-[10px] rounded-full border px-2 py-0.5',
                          t.type === 'email'
                            ? 'border-zinc-700 bg-zinc-800 text-zinc-500'
                            : 'border-emerald-700/40 bg-emerald-500/10 text-emerald-400',
                        )}>
                          {t.type === 'email' ? <Mail size={8} /> : <MessageSquare size={8} />}
                          {t.type === 'email' ? 'Email' : 'WhatsApp'}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">{t.name}</h3>
                      {t.type === 'email' && t.subject && (
                        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 mb-2">
                          <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Assunto</p>
                          <p className="text-[11px] text-zinc-400 truncate">{t.subject}</p>
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                        {t.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 border-t border-zinc-800 pt-3 mt-auto">
                      <button
                        onClick={() => handleUseTemplate(t)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-700 transition-colors"
                      >
                        <Copy size={11} /> Usar
                      </button>
                      <button
                        onClick={() => setModal({
                          editingId: t.id,
                          form: { name: t.name, type: t.type, category: t.category, subject: t.subject, content: t.content },
                        })}
                        className="flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 p-2 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => void handleDeleteTemplate(t.id)}
                        disabled={deletingTpl === t.id}
                        className="flex items-center justify-center rounded-lg p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                      >
                        {deletingTpl === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Tab: History ════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
              <History size={36} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">
                Nenhuma mensagem enviada ainda. Ative um fluxo para começar.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_80px_100px_90px] gap-3 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <span>Destinatário</span>
                <span>Canal</span>
                <span>Status</span>
                <span>Assunto</span>
                <span className="text-right">Enviado em</span>
              </div>
              {logs.map((log, i) => (
                <div key={log.id}
                  className={cn(
                    'grid grid-cols-[1fr_90px_80px_100px_90px] gap-3 items-center px-4 py-3 border-b border-zinc-800/60 last:border-0',
                    i % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-900/10',
                  )}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{log.client_name ?? log.to_address}</p>
                    {log.client_name && (
                      <p className="text-[10px] text-zinc-600 truncate">{log.to_address}</p>
                    )}
                  </div>
                  <div>
                    <span className={cn(
                      'flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      log.channel === 'email'
                        ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                        : 'border-emerald-700/40 bg-emerald-500/10 text-emerald-400',
                    )}>
                      {log.channel === 'email' ? <Mail size={8} /> : <MessageSquare size={8} />}
                      {log.channel === 'email' ? 'Email' : 'WhatsApp'}
                    </span>
                  </div>
                  <div>
                    <span className={cn(
                      'flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      log.status === 'sent'      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                      log.status === 'simulated' ? 'text-blue-400    bg-blue-500/10    border-blue-500/30'    :
                                                   'text-red-400     bg-red-500/10     border-red-500/30',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full',
                        log.status === 'sent'      ? 'bg-emerald-400' :
                        log.status === 'simulated' ? 'bg-blue-400'    : 'bg-red-400',
                      )} />
                      {log.status === 'sent' ? 'Enviado' : log.status === 'simulated' ? 'Simulado' : 'Falhou'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-zinc-500 truncate">{log.subject ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-zinc-600">
                      {new Date(log.sent_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-zinc-700">
                      {new Date(log.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
