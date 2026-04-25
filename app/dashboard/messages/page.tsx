'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Mail, Plus, Play, ToggleLeft, ToggleRight, Loader2,
  Trash2, FileText, History, Zap, Sparkles,
  CheckCircle2, AlertCircle, Clock, Users, Settings2,
  Copy, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'flows' | 'recommended' | 'templates' | 'history'

interface Flow {
  id: string
  name: string
  description: string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  status: 'active' | 'inactive' | 'draft'
  step_count: number
  enrollment_count: number
  created_at: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

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
      {
        delay_days: 1,
        subject: 'Lembrete de pagamento — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Identificamos um pagamento em aberto de <strong>{{valor}}</strong>. Poderia verificar para nós?</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 3,
        subject: '⚠️ Pagamento vencido — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seu pagamento de <strong>{{valor}}</strong> está vencido. Por favor, regularize sua situação o mais breve possível.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 7,
        subject: '🚨 Urgente: pagamento em atraso — {{empresa}}',
        body_html: '<p>Prezado(a) <strong>{{nome}}</strong>,</p><p>Seu pagamento de <strong>{{valor}}</strong> está em atraso há mais de uma semana. Por favor, entre em contato conosco imediatamente.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
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
      {
        delay_days: 0,
        subject: 'Bem-vindo(a) à {{empresa}}! 🎉',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) como nosso cliente.</p><p>Qualquer dúvida, estamos à disposição para ajudar.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 3,
        subject: 'Como está sendo sua experiência? — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Já passaram alguns dias desde o seu início conosco. Como está sendo sua experiência?</p><p>Sua opinião é muito importante para nós!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
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
      {
        delay_days: 0,
        subject: 'Sentimos sua falta — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Faz algum tempo que não nos falamos! Queremos saber como você está e o que podemos fazer por você.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 7,
        subject: 'Oferta especial para você — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Temos uma proposta exclusiva para nossos clientes especiais. Entre em contato conosco!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
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
      {
        delay_days: 0,
        subject: 'Obrigado pela sua compra! — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Recebemos seu pedido com sucesso! Obrigado pela confiança em nossa empresa.</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 7,
        subject: 'Como foi sua experiência? — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Passada uma semana, gostaríamos de saber como foi sua experiência com nosso produto/serviço.</p><p>Sua avaliação é muito importante para nós!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
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
      {
        delay_days: 0,
        subject: 'Seu pagamento vence em 3 dias — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Só um lembrete: seu pagamento de <strong>{{valor}}</strong> vence em 3 dias.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 2,
        subject: 'Último dia: pagamento vence amanhã — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Lembrete final: seu pagamento de <strong>{{valor}}</strong> vence amanhã. Não esqueça!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
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
      {
        delay_days: 0,
        subject: 'Uma dica especial para você — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Preparamos um conteúdo exclusivo para ajudá-lo(a) a alcançar seus objetivos!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 5,
        subject: 'Como está indo? Mais uma dica — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Esperamos que esteja gostando dos nossos conteúdos! Aqui vai mais uma dica valiosa para você.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
      {
        delay_days: 12,
        subject: 'Pronto para o próximo nível? — {{empresa}}',
        body_html: '<p>Olá <strong>{{nome}}</strong>,</p><p>Você tem acompanhado nossos conteúdos e queremos ir além. Que tal conversarmos sobre como podemos te ajudar ainda mais?</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
      },
    ],
  },
]

const TEMPLATES = [
  { id: 't1', category: 'financial', label: '💰 Financeiro', name: 'Cobrança Gentil', subject: 'Lembrete: pagamento em aberto — {{empresa}}', preview: 'Olá {{nome}}, identificamos um pagamento em aberto de {{valor}}. Poderia verificar para nós?', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Identificamos um pagamento em aberto de <strong>{{valor}}</strong>. Poderia verificar para nós?</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't2', category: 'financial', label: '💰 Financeiro', name: 'Cobrança Urgente', subject: '⚠️ Pagamento vencido — {{empresa}}', preview: 'Prezado(a) {{nome}}, seu pagamento está vencido. Regularize sua situação o mais breve possível...', body: '<p>Prezado(a) <strong>{{nome}}</strong>,</p><p>Seu pagamento está vencido. Por favor, regularize sua situação o mais breve possível para evitar inconvenientes.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't3', category: 'financial', label: '💰 Financeiro', name: 'Lembrete de Vencimento', subject: 'Seu pagamento vence amanhã — {{empresa}}', preview: 'Olá {{nome}}, só um lembrete que seu pagamento de {{valor}} vence amanhã.', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Só um lembrete: seu pagamento de <strong>{{valor}}</strong> vence amanhã.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't4', category: 'sales', label: '🛒 Vendas', name: 'Recuperação de Carrinho', subject: 'Você esqueceu algo — {{empresa}}', preview: 'Olá {{nome}}, você deixou itens no carrinho. Finalize sua compra!', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Você deixou itens no carrinho! Não perca essa oportunidade.</p><p><a href="{{link_pagamento}}" style="color:#7c3aed">Finalizar compra →</a></p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't5', category: 'sales', label: '🛒 Vendas', name: 'Abandono de Checkout', subject: 'Complete sua compra — {{empresa}}', preview: 'Olá {{nome}}, seu pedido está esperando por você. Finalize agora!', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seu pedido está esperando por você! Finalize sua compra agora e aproveite.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't6', category: 'sales', label: '🛒 Vendas', name: 'Pós-Compra', subject: 'Obrigado pela sua compra! — {{empresa}}', preview: 'Olá {{nome}}, recebemos seu pedido com sucesso! Obrigado pela confiança.', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Recebemos seu pedido com sucesso! Obrigado pela confiança em nossa empresa.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't7', category: 'relationship', label: '❤️ Relacionamento', name: 'Boas-Vindas', subject: 'Bem-vindo(a) à {{empresa}}! 🎉', preview: 'Olá {{nome}}, seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) como cliente.', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) como nosso cliente.</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't8', category: 'relationship', label: '❤️ Relacionamento', name: 'Reativação de Cliente', subject: 'Sentimos sua falta — {{empresa}}', preview: 'Olá {{nome}}, faz algum tempo que não nos falamos! Queremos saber como você está.', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Faz algum tempo que não nos falamos! Queremos saber como você está e o que podemos fazer por você.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
  { id: 't9', category: 'relationship', label: '❤️ Relacionamento', name: 'Nutrição de Lead', subject: 'Conteúdo especial para você — {{empresa}}', preview: 'Olá {{nome}}, preparamos um conteúdo exclusivo para ajudá-lo(a) a alcançar seus objetivos.', body: '<p>Olá <strong>{{nome}}</strong>,</p><p>Preparamos um conteúdo exclusivo para ajudá-lo(a) a alcançar seus objetivos!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>' },
]

const TRIGGER_INFO: Record<string, { label: string; color: string; description: string }> = {
  manual:         { label: 'Manual',            color: 'text-zinc-400 bg-zinc-800 border-zinc-700',               description: 'Disparado manualmente' },
  new_client:     { label: 'Novo cliente',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', description: 'Quando novo cliente é criado' },
  client_overdue: { label: 'Inadimplente',       color: 'text-red-400 bg-red-500/10 border-red-500/30',            description: 'Quando cliente fica em atraso' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>('flows')
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [activating, setActivating] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [templateFilter, setTemplateFilter] = useState<'all' | 'financial' | 'sales' | 'relationship'>('all')

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadFlows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      if (res.ok) setFlows(await res.json() as Flow[])
    } catch { /* ok */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadFlows() }, [loadFlows])

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rec.name,
          description: rec.description,
          trigger_type: rec.trigger,
          steps: rec.steps,
        }),
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

  async function handleUseTemplate(t: typeof TEMPLATES[0]) {
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: t.name,
        description: `Template: ${t.label}`,
        trigger_type: 'manual',
        steps: [{ delay_days: 0, subject: t.subject, body_html: t.body }],
      }),
    })
    if (res.ok) {
      const { id } = await res.json() as { id: string }
      showToast('Template criado! Redirecionando para o editor...')
      setTimeout(() => { window.location.href = `/dashboard/messages/builder/${id}` }, 800)
    }
  }

  const filteredTemplates = templateFilter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === templateFilter)

  const TABS = [
    { id: 'flows' as Tab,       label: 'Meus Fluxos',   icon: Zap },
    { id: 'recommended' as Tab, label: 'Recomendados',  icon: Sparkles },
    { id: 'templates' as Tab,   label: 'Templates',     icon: FileText },
    { id: 'history' as Tab,     label: 'Histórico',     icon: History },
  ]

  return (
    <div className="min-h-screen p-6 lg:p-8">

      {/* Toast */}
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
                : 'border-red-500/40 bg-red-950 text-red-300'
            )}
          >
            {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/30 p-2">
              <Mail size={20} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Mensagens</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            Automatize comunicações com seus clientes — cobrança, boas-vindas, reativação e muito mais.
          </p>
        </div>
        <Link
          href="/dashboard/messages/builder/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-900/30"
        >
          <Plus size={15} /> Criar fluxo
        </Link>
      </div>

      {/* Stats bar */}
      {!loading && flows.length > 0 && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Fluxos ativos', value: flows.filter(f => f.status === 'active').length, color: 'text-emerald-400' },
            { label: 'Clientes em fluxo', value: flows.reduce((a, f) => a + f.enrollment_count, 0), color: 'text-violet-400' },
            { label: 'Total de passos', value: flows.reduce((a, f) => a + f.step_count, 0), color: 'text-blue-400' },
            { label: 'Total de fluxos', value: flows.length, color: 'text-zinc-300' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === id
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Flows ─────────────────────────────────────────────── */}
      {tab === 'flows' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : flows.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Zap size={24} className="text-violet-400" />
              </div>
              <p className="text-white font-semibold mb-1">Nenhum fluxo criado ainda</p>
              <p className="text-zinc-500 text-sm mb-5">Crie seu primeiro fluxo ou ative um dos nossos fluxos recomendados.</p>
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
                  <motion.div
                    key={flow.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          'h-2.5 w-2.5 rounded-full mt-1.5 shrink-0',
                          flow.status === 'active'  ? 'bg-emerald-400' :
                          flow.status === 'draft'   ? 'bg-amber-400'   : 'bg-zinc-600'
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
                        <button
                          onClick={() => void handleEnroll(flow.id)}
                          disabled={enrolling.has(flow.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-50 transition-colors"
                        >
                          {enrolling.has(flow.id) ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                          Disparar
                        </button>
                        <Link
                          href={`/dashboard/messages/builder/${flow.id}`}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                        >
                          <Settings2 size={11} /> Editar
                        </Link>
                        <button
                          onClick={() => void handleToggle(flow.id)}
                          disabled={toggling.has(flow.id)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            flow.status === 'active'
                              ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/30 hover:bg-emerald-500/15'
                              : 'text-zinc-500 bg-zinc-800 border-zinc-700 hover:text-white hover:border-zinc-600'
                          )}
                        >
                          {toggling.has(flow.id)
                            ? <Loader2 size={11} className="animate-spin" />
                            : flow.status === 'active' ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
                          {flow.status === 'active' ? 'Ativo' : 'Inativo'}
                        </button>
                        <button
                          onClick={() => void handleDelete(flow.id)}
                          disabled={deleting.has(flow.id)}
                          className="rounded-lg p-1.5 text-zinc-700 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                        >
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

      {/* ── Tab: Recommended ───────────────────────────────────────── */}
      {tab === 'recommended' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED.map(rec => {
            const isActivating = activating.has(rec.id)
            const alreadyExists = flows.some(f => f.name === rec.name)
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors"
              >
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

                {/* Step preview */}
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
                      : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-900/20 hover:shadow-violet-900/40'
                  )}
                >
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

      {/* ── Tab: Templates ──────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div>
          <div className="mb-4 flex gap-2 flex-wrap">
            {([
              { id: 'all',          label: '🗂 Todos' },
              { id: 'financial',    label: '💰 Financeiro' },
              { id: 'sales',        label: '🛒 Vendas' },
              { id: 'relationship', label: '❤️ Relacionamento' },
            ] as Array<{ id: typeof templateFilter; label: string }>).map(f => (
              <button
                key={f.id}
                onClick={() => setTemplateFilter(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  templateFilter === f.id
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t.label}</span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-600 rounded-full border border-zinc-800 bg-zinc-800 px-2 py-0.5">
                      <Mail size={8} /> Email
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{t.name}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{t.preview}</p>
                </div>

                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5">
                  <p className="text-[10px] text-zinc-600 font-medium mb-1">Assunto</p>
                  <p className="text-[11px] text-zinc-400 truncate">{t.subject}</p>
                </div>

                <button
                  onClick={() => void handleUseTemplate(t)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-700 transition-colors"
                >
                  <Copy size={11} /> Usar este template
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: History ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : flows.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
              <History size={36} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">Nenhuma atividade ainda. Crie e ative um fluxo para começar.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_110px_80px_80px_80px] gap-3 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <span>Fluxo</span>
                <span>Gatilho</span>
                <span className="text-center">Passos</span>
                <span className="text-center">Clientes</span>
                <span className="text-center">Status</span>
              </div>
              {flows.map((flow, i) => {
                const trigger = TRIGGER_INFO[flow.trigger_type] ?? TRIGGER_INFO.manual
                return (
                  <div
                    key={flow.id}
                    className={cn(
                      'grid grid-cols-[1fr_110px_80px_80px_80px] gap-3 items-center px-4 py-3.5 border-b border-zinc-800/60 last:border-0',
                      i % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-900/10',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{flow.name}</p>
                      {flow.description && (
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate max-w-xs">{flow.description}</p>
                      )}
                    </div>
                    <div>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', trigger.color)}>
                        {trigger.label}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-white">{flow.step_count}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-white">{flow.enrollment_count}</span>
                    </div>
                    <div className="flex justify-center">
                      <span className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        flow.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                        flow.status === 'draft'  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                                                   'text-zinc-500 bg-zinc-800 border-zinc-700'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full',
                          flow.status === 'active' ? 'bg-emerald-400' :
                          flow.status === 'draft'  ? 'bg-amber-400'   : 'bg-zinc-600'
                        )} />
                        {flow.status === 'active' ? 'Ativo' : flow.status === 'draft' ? 'Rascunho' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
