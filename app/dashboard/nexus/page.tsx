'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wifi, WifiOff, Bot, Zap, Users, MessageSquare,
  Flame, ChevronRight, RefreshCw, Save,
  CheckCircle, Clock, ArrowRight, Settings,
  Phone, Building2, Target, Sparkles,
} from 'lucide-react'
import { resolveCompanyId } from '@/lib/get-company-id'
import { cn } from '@/lib/cn'

// ── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  ai: {
    active:     boolean
    nome:       string
    tom:        string
    objetivo:   string
    nicho:      string | null
    instrucoes: string | null
    saudacao:   string | null
  }
  today: {
    mensagens:   number
    leads_novos: number
  }
  pipeline: {
    total:  number
    hot:    number
    closed: number
    stages: Array<{ id: string; nome: string; cor: string; posicao: number; tipo: string; count: number }>
    leads:  Array<{ id: string; name: string; stage: string; temperatura: string; score: number; empresa: string | null; phone: string | null }>
  }
  events: Array<{ tipo: string; canal: string; conteudo: string; created_at: string }>
}

interface WAStatus {
  connected: boolean
  status:    string
  phone:     string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

const STAGE_COLORS: Record<string, string> = {
  novo:        'bg-slate-100 text-slate-600',
  contatado:   'bg-blue-50 text-blue-600',
  qualificado: 'bg-violet-50 text-violet-600',
  proposta:    'bg-amber-50 text-amber-600',
  negociando:  'bg-orange-50 text-orange-600',
  fechado:     'bg-emerald-50 text-emerald-700',
  perdido:     'bg-red-50 text-red-500',
}

function TempDot({ t }: { t: string }) {
  const c = t === 'quente' || t === 'urgente'
    ? 'bg-orange-400'
    : t === 'morno' ? 'bg-amber-300' : 'bg-slate-300'
  return <span className={cn('inline-block w-2 h-2 rounded-full', c)} />
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WABadge({ wa }: { wa: WAStatus | null }) {
  if (!wa) return null
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
      wa.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
    )}>
      {wa.connected
        ? <><Wifi className="w-3 h-3" /> WhatsApp conectado</>
        : <><WifiOff className="w-3 h-3" /> WhatsApp desconectado</>
      }
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex flex-col gap-1">
      <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function EventFeed({ events }: { events: OverviewData['events'] }) {
  if (!events.length) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Nenhuma atividade registrada ainda
      </div>
    )
  }
  return (
    <div className="divide-y divide-slate-50">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 py-3.5 px-1">
          <div className="mt-0.5 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 leading-snug truncate">{ev.conteudo}</p>
            <p className="text-xs text-slate-400 mt-0.5">{ev.canal} · {timeAgo(ev.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function KanbanBoard({ stages }: { stages: OverviewData['pipeline']['stages']; leads: OverviewData['pipeline']['leads'] }) {
  const [moving, setMoving] = useState<string | null>(null)

  async function moveLead(leadId: string, stageId: string, companyId: string) {
    setMoving(leadId)
    await fetch('/api/nexus/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, lead_id: leadId, stage_id: stageId }),
    })
    setMoving(null)
  }

  if (!stages.length) return (
    <div className="py-16 text-center text-slate-400 text-sm">Nenhuma etapa configurada</div>
  )

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map(stage => (
        <div key={stage.id} className="shrink-0 w-56">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stage.nome}</span>
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{stage.count}</span>
          </div>
          <div className="space-y-2">
            {stage.count === 0 && (
              <div className="rounded-xl border-2 border-dashed border-slate-100 h-16 flex items-center justify-center text-xs text-slate-300">
                vazio
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function PersonaTab({
  persona,
  companyId,
}: {
  persona: OverviewData['ai']
  companyId: string
}) {
  const [form, setForm] = useState({
    nome:       persona.nome,
    nicho:      persona.nicho ?? '',
    objetivo:   persona.objetivo,
    tom:        persona.tom,
    instrucoes: persona.instrucoes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/nexus/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, ...form }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (label: string, key: keyof typeof form, multiline?: boolean) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {multiline
        ? <textarea
            rows={3}
            value={form[key]}
            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            className="resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition"
          />
        : <input
            type="text"
            value={form[key]}
            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition"
          />
      }
    </div>
  )

  return (
    <div className="max-w-lg space-y-4">
      {field('Nome da IA', 'nome')}
      {field('Nicho / Mercado', 'nicho')}
      {field('Objetivo principal', 'objetivo')}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-500">Tom da IA</label>
        <select
          value={form.tom}
          onChange={e => setForm(p => ({ ...p, tom: e.target.value }))}
          className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition bg-white"
        >
          {['profissional', 'descontraído', 'consultivo', 'direto', 'empático'].map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>
      {field('Instruções especiais', 'instrucoes', true)}
      <button
        onClick={save}
        disabled={saving}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition',
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-violet-600 hover:bg-violet-700 text-white',
        )}
      >
        {saved ? <><CheckCircle className="w-4 h-4" /> Salvo</> : saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando…</> : <><Save className="w-4 h-4" /> Salvar</>}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'atividade' | 'pipeline' | 'ia'

export default function NexusPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [data,      setData]      = useState<OverviewData | null>(null)
  const [wa,        setWa]        = useState<WAStatus | null>(null)
  const [tab,       setTab]       = useState<Tab>('atividade')
  const [loading,   setLoading]   = useState(true)
  const [toggling,  setToggling]  = useState(false)

  useEffect(() => {
    resolveCompanyId().then(setCompanyId)
  }, [])

  const load = useCallback(async (cid: string) => {
    setLoading(true)
    const [ov, ws] = await Promise.all([
      fetch(`/api/nexus/overview?company_id=${cid}`).then(r => r.json()),
      fetch(`/api/nexus/whatsapp/status?company_id=${cid}`).then(r => r.json()).catch(() => null),
    ])
    setData(ov)
    setWa(ws)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (companyId) load(companyId)
  }, [companyId, load])

  async function toggleAI() {
    if (!data || !companyId) return
    setToggling(true)
    await fetch('/api/nexus/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, is_active: !data.ai.active }),
    })
    await load(companyId)
    setToggling(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Erro ao carregar dados
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'atividade', label: 'Atividade' },
    { key: 'pipeline',  label: `Pipeline (${data.pipeline.total})` },
    { key: 'ia',        label: 'IA' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Hero ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* AI pulse */}
            <div className="relative shrink-0">
              <div className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center',
                data.ai.active ? 'bg-violet-100' : 'bg-slate-100',
              )}>
                <Bot className={cn('w-6 h-6', data.ai.active ? 'text-violet-600' : 'text-slate-400')} />
              </div>
              {data.ai.active && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{data.ai.nome}</p>
              <p className="text-sm text-slate-400 truncate">
                {data.ai.active
                  ? `${data.today.mensagens} mensagens · ${data.today.leads_novos} leads hoje`
                  : 'IA pausada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WABadge wa={wa} />
            <button
              onClick={toggleAI}
              disabled={toggling}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition',
                data.ai.active
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  : 'bg-violet-600 hover:bg-violet-700 text-white',
                toggling && 'opacity-50 cursor-not-allowed',
              )}
            >
              {data.ai.active ? 'Pausar IA' : 'Ativar IA'}
            </button>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Leads hoje"   value={data.today.leads_novos} sub="novos" />
          <MetricCard label="Mensagens"    value={data.today.mensagens}   sub="enviadas hoje" />
          <MetricCard label="Leads quentes" value={data.pipeline.hot}     sub={`de ${data.pipeline.total}`} />
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex border-b border-slate-100">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 py-3.5 text-sm font-medium transition',
                  tab === t.key
                    ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40'
                    : 'text-slate-400 hover:text-slate-600',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'atividade' && (
              <EventFeed events={data.events} />
            )}

            {tab === 'pipeline' && (
              <KanbanBoard stages={data.pipeline.stages} leads={data.pipeline.leads} />
            )}

            {tab === 'ia' && companyId && (
              <PersonaTab persona={data.ai} companyId={companyId} />
            )}
          </div>
        </div>

        {/* ── Refresh ── */}
        <div className="flex justify-end">
          <button
            onClick={() => companyId && load(companyId)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

      </div>
    </div>
  )
}
