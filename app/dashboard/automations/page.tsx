'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Send, Plus, Zap, Mail, Users, Play,
  Loader2, ArrowRight, Clock, CheckCircle2,
  Trash2, ToggleLeft, ToggleRight, AlertCircle,
  Star, Sparkles, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id:      string
  type:    'success' | 'error' | 'info'
  message: string
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, show, dismiss }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Automation {
  id: string
  name: string
  description: string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  status: 'active' | 'inactive' | 'draft'
  step_count: number
  enrolled_count: number
  created_at: string
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'cobranca',
    icon: '💰',
    name: 'Recuperação de Cobrança',
    description: 'Envie lembretes automáticos para clientes com pagamentos em atraso. Sequência de 3 emails: D+1, D+3 e D+7.',
    trigger_type: 'client_overdue' as const,
    channel: 'Email',
    steps: [
      {
        subject: 'Lembrete: pagamento pendente — {empresa}',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Lembrete de pagamento</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Identificamos um pagamento pendente em seu cadastro. Caso já tenha realizado o pagamento, por favor desconsidere este aviso.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 1,
      },
      {
        subject: 'Atenção: pagamento ainda pendente — {empresa}',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Pagamento pendente</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Este é um segundo lembrete sobre um pagamento em aberto. Por favor, regularize o quanto antes para evitar maiores transtornos.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 2,
      },
      {
        subject: 'Urgente: pagamento vencido — {empresa}',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #ef444455;overflow:hidden;"><div style="background:#ef4444;padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">⚠️ Pagamento urgente</h1><p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Percebemos que seu pagamento está pendente há vários dias. Pedimos que regularize com urgência para evitar cobranças adicionais.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 4,
      },
    ],
  },
  {
    id: 'boas-vindas',
    icon: '👋',
    name: 'Boas-vindas ao cliente',
    description: 'Envie uma mensagem de boas-vindas quando um novo cliente for adicionado ao sistema.',
    trigger_type: 'new_client' as const,
    channel: 'Email',
    steps: [
      {
        subject: 'Bem-vindo, {nome}! Obrigado por confiar em nós',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#059669,#0891b2);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Bem-vindo, {nome}! 👋</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">É um prazer ter você como cliente da <strong style="color:#d4d4d8;">{empresa}</strong>. Estamos à disposição para o que precisar.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 0,
      },
      {
        subject: 'Como podemos ajudar você, {nome}?',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Acompanhamento</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Passamos para saber como está sendo sua experiência. Ficamos à disposição para qualquer dúvida ou sugestão.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 3,
      },
    ],
  },
  {
    id: 'reativacao',
    icon: '🔄',
    name: 'Reativação de clientes',
    description: 'Reconquiste clientes que não interagem há tempo. Ative manualmente para a lista que desejar.',
    trigger_type: 'manual' as const,
    channel: 'Email',
    steps: [
      {
        subject: 'Sentimos sua falta, {nome}!',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Sentimos sua falta! 💛</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Faz um tempo que não nos falamos e queríamos saber como você está. Temos novidades e estamos aqui para ajudar.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 0,
      },
      {
        subject: '{nome}, uma oferta especial para você',
        body_html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="background:#09090b;font-family:-apple-system,sans-serif;margin:0;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;"><div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Oferta especial para você 🎁</h1><p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px;">{empresa}</p></div><div style="padding:32px;"><p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">{nome}</strong>,</p><p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Como cliente especial, preparamos uma oferta exclusiva para você. Entre em contato conosco para saber mais.</p><p style="color:#52525b;font-size:12px;text-align:center;border-top:1px solid #27272a;padding-top:20px;margin:0;">Atenciosamente, <strong style="color:#71717a;">Equipe {empresa}</strong></p></div></div></body></html>`,
        delay_days: 7,
      },
    ],
  },
]

const TRIGGER_LABELS: Record<string, string> = {
  manual:          'Disparo manual',
  new_client:      'Novo cliente',
  client_overdue:  'Cliente em atraso',
}

const TRIGGER_COLORS: Record<string, string> = {
  manual:         'bg-zinc-700/50 text-zinc-300',
  new_client:     'bg-emerald-500/20 text-emerald-400',
  client_overdue: 'bg-amber-500/20 text-amber-400',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [tab, setTab]               = useState<'mine' | 'templates'>('mine')
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]       = useState(true)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [seeding, setSeeding]       = useState(false)
  const autoSeedDone                = useRef(false)
  const { toasts, show: showToast, dismiss } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/automations')
      const data = await res.json() as { automations?: Automation[] }
      setAutomations(data.automations ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Derived: does a client_overdue automation already exist? ──────────────
  const hasSmartAuto = automations.some(a => a.trigger_type === 'client_overdue')

  // ── Seed handler ──────────────────────────────────────────────────────────
  const handleSeed = useCallback(async () => {
    if (seeding) return
    setSeeding(true)
    try {
      const res  = await fetch('/api/automations/seed', { method: 'POST' })
      const data = await res.json() as { id?: string; created?: boolean; error?: string }
      if (res.ok) {
        showToast(
          'success',
          data.created
            ? 'Automações inteligentes ativadas com sucesso 🚀'
            : 'Automações já estavam ativas ✅',
        )
        await load()
      } else {
        showToast('error', data.error ?? 'Erro ao ativar automações')
      }
    } catch {
      showToast('error', 'Erro de conexão')
    } finally {
      setSeeding(false)
    }
  }, [seeding, showToast, load])

  // ── Auto-seed once after first load if no overdue automation exists ───────
  useEffect(() => {
    if (!loading && !hasSmartAuto && !autoSeedDone.current) {
      autoSeedDone.current = true
      void handleSeed()
    }
  }, [loading, hasSmartAuto, handleSeed])

  useEffect(() => { void load() }, [load])

  async function useTemplate(tpl: typeof TEMPLATES[number]) {
    setCreatingId(tpl.id)
    try {
      const res = await fetch('/api/automations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         tpl.name,
          description:  tpl.description,
          trigger_type: tpl.trigger_type,
          steps:        tpl.steps,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { id: string }
        await load()
        setTab('mine')
        // Auto-activate
        await fetch(`/api/automations/${data.id}/toggle`, { method: 'POST' })
        await load()
      }
    } finally {
      setCreatingId(null)
    }
  }

  async function toggleStatus(id: string) {
    setTogglingId(id)
    try {
      await fetch(`/api/automations/${id}/toggle`, { method: 'POST' })
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm('Excluir esta automação? Esta ação não pode ser desfeita.')) return
    setDeletingId(id)
    try {
      await fetch(`/api/automations/${id}`, { method: 'DELETE' })
      setAutomations(prev => prev.filter(a => a.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function enrollNow(id: string) {
    setEnrollingId(id)
    try {
      const res  = await fetch(`/api/automations/${id}/enroll`, { method: 'POST' })
      const data = await res.json() as { enrolled?: number }
      alert(`${data.enrolled ?? 0} clientes adicionados à automação.`)
      await load()
    } finally {
      setEnrollingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 lg:p-8">

      {/* ── Toast notifications ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 64, scale: 0.95 }}
              animate={{ opacity: 1, x: 0,  scale: 1 }}
              exit={{ opacity: 0, x: 64, scale: 0.95 }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl text-sm font-medium max-w-xs',
                t.type === 'success' && 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/50',
                t.type === 'error'   && 'bg-red-900/90 text-red-200 border border-red-700/50',
                t.type === 'info'    && 'bg-zinc-800 text-zinc-200 border border-zinc-700',
              )}
            >
              {t.type === 'success' && <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />}
              {t.type === 'error'   && <AlertCircle  size={16} className="shrink-0 text-red-400" />}
              {t.type === 'info'    && <Sparkles     size={16} className="shrink-0 text-violet-400" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="shrink-0 text-current opacity-60 hover:opacity-100">
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-600/30">
              <Send size={18} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Mensagens</h1>
          </div>
          <p className="text-sm text-zinc-400 ml-13">
            Automatize o envio de e-mails para seus clientes
          </p>
        </div>
        <Link
          href="/dashboard/automations/new"
          className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus size={16} />
          Criar automação
        </Link>
      </div>

      {/* ── Smart Automations Banner ── */}
      <AnimatePresence>
        {!loading && (
          <motion.div
            key="smart-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mb-6 flex items-center justify-between gap-4 rounded-2xl border p-4',
              hasSmartAuto
                ? 'bg-emerald-950/40 border-emerald-700/30'
                : 'bg-violet-950/40 border-violet-700/30',
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                hasSmartAuto ? 'bg-emerald-500/20' : 'bg-violet-600/20',
              )}>
                {hasSmartAuto
                  ? <CheckCircle2 size={17} className="text-emerald-400" />
                  : <Sparkles     size={17} className="text-violet-400" />
                }
              </div>
              <div>
                <p className={cn('text-sm font-semibold', hasSmartAuto ? 'text-emerald-300' : 'text-white')}>
                  {hasSmartAuto ? 'Automações inteligentes ativas' : 'Ativar automações inteligentes'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {hasSmartAuto
                    ? 'Clientes inadimplentes recebem e-mails automáticos em D+0, D+3 e D+7.'
                    : 'Cobre clientes inadimplentes automaticamente com sequência de 3 e-mails.'}
                </p>
              </div>
            </div>

            {hasSmartAuto ? (
              <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                Ativa
              </span>
            ) : (
              <button
                onClick={() => void handleSeed()}
                disabled={seeding}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {seeding
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Zap      size={14} />
                }
                {seeding ? 'Ativando...' : 'Ativar agora'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900 p-1 w-fit border border-zinc-800 mt-2">
        {[
          { key: 'mine',      label: 'Minhas Automações' },
          { key: 'templates', label: 'Modelos' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'mine' | 'templates')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-violet-600 text-white shadow'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Minhas Automações ── */}
      <AnimatePresence mode="wait">
        {tab === 'mine' && (
          <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={24} className="animate-spin text-violet-400" />
              </div>
            ) : automations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800">
                  <Send size={32} className="text-zinc-600" />
                </div>
                <p className="text-lg font-semibold text-white mb-2">Nenhuma automação criada</p>
                <p className="text-sm text-zinc-500 mb-6 max-w-sm">
                  Crie sua primeira automação ou escolha um modelo pronto para começar a enviar e-mails automaticamente.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTab('templates')}
                    className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <Star size={15} />
                    Ver modelos
                  </button>
                  <Link
                    href="/dashboard/automations/new"
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    <Plus size={15} />
                    Criar automação
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {automations.map(auto => (
                  <motion.div
                    key={auto.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors"
                  >
                    {/* Status + trigger */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TRIGGER_COLORS[auto.trigger_type])}>
                        {TRIGGER_LABELS[auto.trigger_type]}
                      </span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold',
                        auto.status === 'active'  ? 'bg-emerald-500/20 text-emerald-400' :
                        auto.status === 'inactive' ? 'bg-zinc-700/50 text-zinc-400' :
                        'bg-zinc-700/50 text-zinc-500',
                      )}>
                        {auto.status === 'active' ? 'Ativa' : auto.status === 'inactive' ? 'Inativa' : 'Rascunho'}
                      </span>
                    </div>

                    {/* Name */}
                    <div>
                      <h3 className="font-semibold text-white text-base mb-1">{auto.name}</h3>
                      <p className="text-xs text-zinc-500 line-clamp-2">{auto.description}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="text-violet-400" />
                        <span>{auto.step_count} email{auto.step_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-emerald-400" />
                        <span>{auto.enrolled_count} ativo{auto.enrolled_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Flow preview */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {Array.from({ length: Math.min(auto.step_count, 5) }).map((_, i) => (
                        <div key={i} className="flex items-center gap-1 shrink-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-600/30">
                            <Mail size={11} className="text-violet-400" />
                          </div>
                          {i < Math.min(auto.step_count, 5) - 1 && (
                            <ArrowRight size={11} className="text-zinc-600 shrink-0" />
                          )}
                        </div>
                      ))}
                      {auto.step_count > 5 && (
                        <span className="text-[10px] text-zinc-600 ml-1">+{auto.step_count - 5}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 border-t border-zinc-800 pt-3 mt-auto">
                      {/* Toggle */}
                      <button
                        onClick={() => void toggleStatus(auto.id)}
                        disabled={togglingId === auto.id}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                          auto.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                        )}
                      >
                        {togglingId === auto.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : auto.status === 'active' ? (
                          <ToggleRight size={13} />
                        ) : (
                          <ToggleLeft size={13} />
                        )}
                        {auto.status === 'active' ? 'Ativa' : 'Ativar'}
                      </button>

                      {/* Enroll now (manual trigger) */}
                      {auto.trigger_type !== 'new_client' && (
                        <button
                          onClick={() => void enrollNow(auto.id)}
                          disabled={enrollingId === auto.id}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          {enrollingId === auto.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                          Disparar
                        </button>
                      )}

                      {/* Edit */}
                      <Link
                        href={`/dashboard/automations/${auto.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        Editar
                      </Link>

                      {/* Delete */}
                      <button
                        onClick={() => void deleteAutomation(auto.id)}
                        disabled={deletingId === auto.id}
                        className="ml-auto flex items-center justify-center rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        {deletingId === auto.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Modelos ── */}
        {tab === 'templates' && (
          <motion.div key="templates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-sm text-zinc-500 mb-6">
              Escolha um modelo pronto e comece a enviar e-mails automaticamente em segundos.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors"
                >
                  {/* Icon + channel */}
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
                      {tpl.icon}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-violet-600/15 border border-violet-600/30 px-2.5 py-1">
                      <Mail size={11} className="text-violet-400" />
                      <span className="text-[11px] font-semibold text-violet-400">{tpl.channel}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white text-base mb-1.5">{tpl.name}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{tpl.description}</p>
                  </div>

                  {/* Flow preview */}
                  <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2.5">Fluxo</p>
                    <div className="flex flex-col gap-2">
                      {/* Trigger */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-700 shrink-0">
                          <Zap size={10} className="text-amber-400" />
                        </div>
                        <span className="text-xs text-zinc-400">{TRIGGER_LABELS[tpl.trigger_type]}</span>
                      </div>
                      {tpl.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="flex flex-col items-center">
                            <div className="w-px h-2 bg-zinc-700" />
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600/20 border border-violet-600/30 shrink-0">
                              <Mail size={10} className="text-violet-400" />
                            </div>
                          </div>
                          <div className="pt-2 min-w-0">
                            <p className="text-[11px] text-zinc-300 truncate">{step.subject.replace('{empresa}', 'Empresa')}</p>
                            {step.delay_days > 0 && (
                              <p className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5">
                                <Clock size={8} />
                                Após {step.delay_days} dia{step.delay_days !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => void useTemplate(tpl)}
                    disabled={creatingId === tpl.id}
                    className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {creatingId === tpl.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {creatingId === tpl.id ? 'Criando...' : 'Usar modelo'}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
