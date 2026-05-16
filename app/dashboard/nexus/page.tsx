'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Bot, Zap, Users, MessageSquare, Wifi, WifiOff,
  RefreshCw, Save, CheckCircle, Sparkles, Wand2,
  Bell, Brain, BarChart3, TrendingUp, Play, Pause,
  ArrowRight, Clock,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function WABadge({ wa }: { wa: WAStatus | null }) {
  if (!wa) return null
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
      wa.connected ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20',
    )}>
      {wa.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {wa.connected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl px-5 py-4 flex flex-col gap-1">
      <p className="text-[11px] text-zinc-500 font-medium tracking-wider uppercase">{label}</p>
      <p className={cn('text-3xl font-semibold leading-none', accent ?? 'text-white')}>{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

// ── Painel Principal ──────────────────────────────────────────────────────────

function PainelTab({
  data,
  wa,
  companyId,
  onToggle,
  toggling,
}: {
  data: OverviewData
  wa: WAStatus | null
  companyId: string
  onToggle: () => void
  toggling: boolean
}) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', data.ai.active ? 'bg-violet-600/20' : 'bg-zinc-800')}>
              <Bot className={cn('w-6 h-6', data.ai.active ? 'text-violet-400' : 'text-zinc-500')} />
            </div>
            {data.ai.active && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-zinc-950 animate-pulse" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white">{data.ai.nome}</p>
            <p className="text-sm text-zinc-500 truncate">
              {data.ai.active
                ? `${data.today.mensagens} mensagens · ${data.today.leads_novos} leads hoje`
                : 'IA pausada — ative para começar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <WABadge wa={wa} />
          <button
            onClick={onToggle}
            disabled={toggling}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              data.ai.active
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-violet-600 hover:bg-violet-500 text-white',
              toggling && 'opacity-50 cursor-not-allowed',
            )}
          >
            {data.ai.active
              ? <><Pause className="w-3.5 h-3.5" /> Pausar IA</>
              : <><Play className="w-3.5 h-3.5" /> Ativar IA</>
            }
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Leads hoje"    value={data.today.leads_novos} sub="novos" accent="text-violet-400" />
        <MetricCard label="Mensagens"     value={data.today.mensagens}   sub="enviadas hoje" />
        <MetricCard label="Leads quentes" value={data.pipeline.hot}      sub={`de ${data.pipeline.total} total`} accent="text-orange-400" />
      </div>

      {/* Activity */}
      <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800/60">
          <p className="text-sm font-medium text-zinc-300">Atividade recente</p>
        </div>
        {!data.events.length ? (
          <div className="py-12 text-center text-zinc-600 text-sm">Nenhuma atividade registrada ainda</div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {data.events.slice(0, 8).map((ev, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-300 leading-snug truncate">{ev.conteudo}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{ev.canal} · {timeAgo(ev.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({ data }: { data: OverviewData }) {
  if (!data.pipeline.stages.length) {
    return <div className="py-16 text-center text-zinc-600 text-sm">Nenhuma etapa configurada</div>
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total leads"  value={data.pipeline.total}  />
        <MetricCard label="Quentes"      value={data.pipeline.hot}    accent="text-orange-400" />
        <MetricCard label="Fechados"     value={data.pipeline.closed} accent="text-emerald-400" />
        <MetricCard label="Etapas"       value={data.pipeline.stages.length} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.pipeline.stages.map(stage => (
          <div key={stage.id} className="shrink-0 w-52 bg-zinc-900 border border-zinc-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide truncate">{stage.nome}</span>
              <span className="text-xs bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 shrink-0 ml-2">{stage.count}</span>
            </div>
            {stage.count === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-zinc-800 h-12 flex items-center justify-center">
                <span className="text-xs text-zinc-700">vazio</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.pipeline.leads
                  .filter(l => l.stage === stage.nome.toLowerCase() || l.stage === stage.nome)
                  .slice(0, 3)
                  .map(lead => (
                    <div key={lead.id} className="bg-zinc-800/60 rounded-xl px-3 py-2">
                      <p className="text-xs text-zinc-300 font-medium truncate">{lead.name}</p>
                      <p className="text-[10px] text-zinc-600">{lead.empresa ?? '—'}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── IA Config Tab ─────────────────────────────────────────────────────────────

function IAConfigTab({ persona, companyId }: { persona: OverviewData['ai']; companyId: string }) {
  const [form, setForm] = useState({
    nome:       persona.nome,
    nicho:      persona.nicho ?? '',
    objetivo:   persona.objetivo,
    tom:        persona.tom,
    instrucoes: persona.instrucoes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

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

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-medium text-zinc-300">Identidade da IA</p>

        {[
          { label: 'Nome da IA',           key: 'nome'      as const },
          { label: 'Nicho / Mercado',      key: 'nicho'     as const },
          { label: 'Objetivo principal',   key: 'objetivo'  as const },
        ].map(({ label, key }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">{label}</label>
            <input
              type="text"
              value={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className="bg-zinc-800 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition"
            />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Tom da IA</label>
          <select
            value={form.tom}
            onChange={e => setForm(p => ({ ...p, tom: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition"
          >
            {['profissional', 'descontraído', 'consultivo', 'direto', 'empático'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Instruções especiais</label>
          <textarea
            rows={3}
            value={form.instrucoes}
            onChange={e => setForm(p => ({ ...p, instrucoes: e.target.value }))}
            placeholder="Ex: Não oferecer desconto sem aprovação. Perguntar sempre pelo nome do cliente..."
            className="resize-none bg-zinc-800 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
          saved ? 'bg-emerald-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white',
          saving && 'opacity-60 cursor-not-allowed',
        )}
      >
        {saved
          ? <><CheckCircle className="w-4 h-4" /> Salvo</>
          : saving
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando…</>
            : <><Save className="w-4 h-4" /> Salvar configurações</>
        }
      </button>
    </div>
  )
}

// ── Placeholder sections ──────────────────────────────────────────────────────

function ComingSoon({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-300">{title}</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-xs">{desc}</p>
      </div>
      <div className="inline-flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1">
        <Clock className="w-3 h-3" /> Em breve
      </div>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type NexusTab = 'painel' | 'pipeline' | 'ia' | 'automacoes' | 'insights' | 'criativos' | 'agentes'

const TABS: Array<{ key: NexusTab; label: string; icon: React.ElementType }> = [
  { key: 'painel',    label: 'Painel',     icon: Bot },
  { key: 'pipeline',  label: 'Pipeline',   icon: TrendingUp },
  { key: 'ia',        label: 'IA',         icon: Sparkles },
  { key: 'automacoes',label: 'Automações', icon: Wand2 },
  { key: 'insights',  label: 'Insights',   icon: BarChart3 },
  { key: 'criativos', label: 'Criativos',  icon: Brain },
  { key: 'agentes',   label: 'Agentes',    icon: Users },
]

// ── Inner content (reads search params) ──────────────────────────────────────

function NexusContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [data,      setData]      = useState<OverviewData | null>(null)
  const [wa,        setWa]        = useState<WAStatus | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [toggling,  setToggling]  = useState(false)

  const rawTab = searchParams.get('tab') as NexusTab | null
  const tab    = TABS.find(t => t.key === rawTab)?.key ?? 'painel'

  function setTab(t: NexusTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.replace(`/dashboard/nexus?${params.toString()}`, { scroll: false })
  }

  useEffect(() => { resolveCompanyId().then(setCompanyId) }, [])

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

  useEffect(() => { if (companyId) load(companyId) }, [companyId, load])

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
        <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Erro ao carregar dados
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all',
              tab === t.key
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60',
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => companyId && load(companyId)}
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition px-2"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      {tab === 'painel' && (
        <PainelTab data={data} wa={wa} companyId={companyId!} onToggle={toggleAI} toggling={toggling} />
      )}
      {tab === 'pipeline' && <PipelineTab data={data} />}
      {tab === 'ia'       && companyId && <IAConfigTab persona={data.ai} companyId={companyId} />}
      {tab === 'automacoes' && (
        <ComingSoon icon={<Wand2 className="w-6 h-6" />} title="Automações" desc="Configure fluxos automáticos de follow-up, recuperação de leads e campanhas programadas." />
      )}
      {tab === 'insights' && (
        <ComingSoon icon={<BarChart3 className="w-6 h-6" />} title="Insights da IA" desc="Análise preditiva de conversão, score de leads e recomendações inteligentes." />
      )}
      {tab === 'criativos' && (
        <ComingSoon icon={<Brain className="w-6 h-6" />} title="Criativos" desc="Geração automática de copies, campanhas e mensagens personalizadas por segmento." />
      )}
      {tab === 'agentes' && (
        <ComingSoon icon={<Users className="w-6 h-6" />} title="Agentes IA" desc="Configure agentes especializados: SDR, Closer, Suporte, Retenção — cada um com sua personalidade." />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NexusPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">IA NEXUS</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Sistema operacional inteligente da sua empresa</p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
          </div>
        }>
          <NexusContent />
        </Suspense>
      </div>
    </div>
  )
}
