'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Zap, Target, TrendingUp, AlertTriangle,
  MessageSquare, Users, CheckCircle, Clock, Activity,
  ChevronRight, RefreshCw, Send, Bot, Shield,
  BarChart2, ArrowUpRight, ArrowDownRight,
  Flame, Snowflake, Thermometer, Phone,
} from 'lucide-react'
import { resolveCompanyId } from '@/lib/get-company-id'
import { cn } from '@/lib/cn'

// ── Types ──────────────────────────────────────────────────────────────────

interface DiagnosticScore {
  score_aquisicao:   number
  score_conversao:   number
  score_automacao:   number
  score_retencao:    number
  score_operacional: number
  risco:             string
  dependencia:       string
  perda_estimada:    number
  potencial_crescimento: number
  gargalos:          string[]
  recomendacoes:     Array<{ prioridade: string; acao: string; impacto: string }>
}

interface SellerTask {
  id:           string
  tipo:         string
  canal:        string
  status:       string
  agendado_para: string
  conteudo:     string | null
  leads?:       { name: string; phone: string; empresa: string; score: number } | null
}

interface SellerEvent {
  tipo:       string
  canal:      string
  conteudo:   string
  created_at: string
}

interface AIPersona {
  nome:     string
  tom:      string
  objetivo: string
  nicho:    string | null
  is_active: boolean
}

interface AIMemory {
  taxa_conversao: number
  taxa_resposta:  number
  objecoes_comuns: string[] | null
}

// ── Score Ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#1f2937" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {score}
        </span>
      </div>
      <span className="text-[10px] text-zinc-400 text-center leading-tight">{label}</span>
    </div>
  )
}

// ── Temperatura badge ──────────────────────────────────────────────────────

function TempBadge({ temp }: { temp: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    frio:     { icon: <Snowflake className="w-3 h-3" />, label: 'Frio',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    morno:    { icon: <Thermometer className="w-3 h-3" />, label: 'Morno', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    quente:   { icon: <Flame className="w-3 h-3" />, label: 'Quente',     cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
    urgente:  { icon: <Zap className="w-3 h-3" />, label: 'Urgente',      cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
  }
  const c = config[temp] ?? config.frio
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border', c.cls)}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Risk Badge ─────────────────────────────────────────────────────────────

function RiskBadge({ risco }: { risco: string }) {
  const colors: Record<string, string> = {
    BAIXO:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    MEDIO:   'text-amber-400 bg-amber-500/10 border-amber-500/25',
    ALTO:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
    CRITICO: 'text-red-400 bg-red-500/10 border-red-500/25',
  }
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded border', colors[risco] ?? colors.MEDIO)}>
      {risco}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function NexusDashboard() {
  const [companyId, setCompanyId]     = useState<string | null>(null)
  const [diagnostic, setDiagnostic]   = useState<DiagnosticScore | null>(null)
  const [tasks, setTasks]             = useState<SellerTask[]>([])
  const [events, setEvents]           = useState<SellerEvent[]>([])
  const [persona, setPersona]         = useState<AIPersona | null>(null)
  const [memory, setMemory]           = useState<AIMemory | null>(null)
  const [loading, setLoading]         = useState(true)
  const [running, setRunning]         = useState(false)
  const [activeTab, setActiveTab]     = useState<'overview' | 'tasks' | 'persona' | 'events'>('overview')

  const load = useCallback(async (cid: string) => {
    const [diagRes, tasksRes, eventsRes, personaRes, memoryRes] = await Promise.allSettled([
      fetch(`/api/nexus/diagnostic?company_id=${cid}`).then(r => r.json()),
      fetch(`/api/nexus/tasks?company_id=${cid}&limit=20`).then(r => r.json()),
      fetch(`/api/nexus/seller?company_id=${cid}`).then(r => r.json()),
      fetch(`/api/nexus/persona?company_id=${cid}`).then(r => r.json()),
      fetch(`/api/nexus/memory?company_id=${cid}`).then(r => r.json()),
    ])

    if (diagRes.status === 'fulfilled') setDiagnostic(diagRes.value.diagnostics?.[0] ?? null)
    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.tasks ?? [])
    if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.tasks ?? [])
    if (personaRes.status === 'fulfilled') setPersona(personaRes.value.persona ?? null)
    if (memoryRes.status === 'fulfilled') setMemory(memoryRes.value.memory ?? null)
  }, [])

  useEffect(() => {
    resolveCompanyId().then(cid => {
      if (!cid) { setLoading(false); return }
      setCompanyId(cid)
      load(cid).finally(() => setLoading(false))
    })
  }, [load])

  const runDiagnostic = async () => {
    if (!companyId || running) return
    setRunning(true)
    try {
      const res = await fetch('/api/nexus/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      const json = await res.json() as { diagnostic?: DiagnosticScore }
      if (json.diagnostic) setDiagnostic(json.diagnostic)
    } finally {
      setRunning(false)
    }
  }

  const runTask = async (task: SellerTask) => {
    if (!companyId || !task.leads?.phone) return
    await fetch('/api/nexus/seller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        task_id: task.id,
        action: {
          type:    task.tipo,
          leadId:  task.id,
          phone:   task.leads.phone,
          context: task.conteudo,
        },
      }),
    })
    await load(companyId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-zinc-400">
          <Brain className="w-6 h-6 animate-pulse text-violet-400" />
          <span>Carregando NEXUS...</span>
        </div>
      </div>
    )
  }

  const pendingTasks = tasks.filter(t => t.status === 'pendente')
  const totalScore   = diagnostic?.score_operacional ?? 0

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center border border-violet-500/25">
            <Brain className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">NEXUS Command Center</h1>
            <p className="text-xs text-zinc-500">Sistema Operacional de IA Comercial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {persona && (
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <div className={cn('w-2 h-2 rounded-full', persona.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600')} />
              <span className="text-xs text-zinc-300">{persona.nome}</span>
            </div>
          )}
          <button
            onClick={runDiagnostic}
            disabled={running}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            {running ? 'Analisando...' : 'Diagnosticar'}
          </button>
        </div>
      </div>

      {/* Operational Score Banner */}
      {diagnostic && (
        <div className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-zinc-900 border border-violet-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              {/* Big score */}
              <div className="text-center">
                <div className={cn(
                  'text-5xl font-black',
                  totalScore >= 70 ? 'text-emerald-400' : totalScore >= 40 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {totalScore}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Score Operacional</div>
              </div>

              {/* Mini rings */}
              <div className="flex items-center gap-4">
                <ScoreRing score={diagnostic.score_aquisicao}  label="Aquisição"  color="#8b5cf6" />
                <ScoreRing score={diagnostic.score_conversao}  label="Conversão"  color="#06b6d4" />
                <ScoreRing score={diagnostic.score_automacao}  label="Automação"  color="#10b981" />
                <ScoreRing score={diagnostic.score_retencao}   label="Retenção"   color="#f59e0b" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Risco:</span>
                <RiskBadge risco={diagnostic.risco} />
              </div>
              <div className="text-xs text-zinc-400">
                Potencial: <span className="text-emerald-400 font-bold">+R${diagnostic.potencial_crescimento.toLocaleString()}</span>
              </div>
              <div className="text-xs text-zinc-400">
                Perda estimada: <span className="text-red-400">R${diagnostic.perda_estimada.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
        {(['overview', 'tasks', 'persona', 'events'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'text-xs font-medium px-4 py-1.5 rounded-lg transition-colors capitalize',
              activeTab === tab
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            {tab === 'overview' ? 'Visão Geral' : tab === 'tasks' ? 'Tarefas IA' : tab === 'persona' ? 'Persona IA' : 'Eventos'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Bottlenecks */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Gargalos</h3>
            </div>
            {diagnostic?.gargalos && diagnostic.gargalos.length > 0 ? (
              <div className="space-y-2">
                {diagnostic.gargalos.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    {g}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Nenhum gargalo crítico detectado</p>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white">Recomendações IA</h3>
            </div>
            {diagnostic?.recomendacoes && diagnostic.recomendacoes.length > 0 ? (
              <div className="space-y-2">
                {diagnostic.recomendacoes.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-zinc-800/50 rounded-lg">
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                      r.prioridade === 'CRÍTICA' ? 'bg-red-500/20 text-red-400' :
                      r.prioridade === 'ALTA' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-amber-500/20 text-amber-400'
                    )}>
                      {r.prioridade}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{r.acao}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">{r.impacto}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Execute o diagnóstico para gerar recomendações</p>
            )}
          </div>

          {/* AI Memory Stats */}
          {memory && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Memória IA</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-violet-400">{(memory.taxa_conversao || 0).toFixed(1)}%</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Taxa Conversão</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{(memory.taxa_resposta || 0).toFixed(1)}%</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Taxa Resposta</div>
                </div>
              </div>
              {memory.objecoes_comuns && memory.objecoes_comuns.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-zinc-500 mb-1.5">Objeções comuns:</p>
                  {memory.objecoes_comuns.slice(0, 3).map((o, i) => (
                    <div key={i} className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" /> {o}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending tasks summary */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Próximas Tarefas IA</h3>
              </div>
              <span className="text-xs text-zinc-500">{pendingTasks.length} pendentes</span>
            </div>
            {pendingTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                <div className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{task.leads?.name ?? 'Lead sem nome'}</p>
                  <p className="text-[10px] text-zinc-500">{task.tipo} · {task.canal}</p>
                </div>
                <button
                  onClick={() => runTask(task)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 shrink-0"
                >
                  <Send className="w-3 h-3" /> Executar
                </button>
              </div>
            ))}
            {pendingTasks.length === 0 && (
              <p className="text-xs text-zinc-500">Nenhuma tarefa pendente</p>
            )}
          </div>

        </div>
      )}

      {/* ── TASKS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma tarefa agendada</p>
            </div>
          ) : tasks.map(task => (
            <div key={task.id} className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                task.status === 'concluido' ? 'bg-emerald-500/15' :
                task.status === 'falhou'   ? 'bg-red-500/15' :
                task.status === 'executando' ? 'bg-violet-500/15' : 'bg-zinc-800'
              )}>
                {task.status === 'concluido' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                 task.status === 'falhou'    ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
                 task.status === 'executando' ? <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" /> :
                 <Clock className="w-4 h-4 text-zinc-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{task.leads?.name ?? 'Lead'}</p>
                  {task.leads?.empresa && (
                    <span className="text-[10px] text-zinc-500 truncate">{task.leads.empresa}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-zinc-500">{task.tipo}</span>
                  <span className="text-[10px] text-zinc-600">·</span>
                  <span className="text-[10px] text-zinc-500">{task.canal}</span>
                  {task.leads?.phone && (
                    <>
                      <span className="text-[10px] text-zinc-600">·</span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        {task.leads.phone}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-500">
                  {new Date(task.agendado_para).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
                {task.status === 'pendente' && task.leads?.phone && (
                  <button
                    onClick={() => runTask(task)}
                    className="flex items-center gap-1 text-[10px] bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Send className="w-3 h-3" /> Executar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PERSONA TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'persona' && (
        <div className="space-y-4">
          {persona ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-violet-600/20 rounded-xl flex items-center justify-center border border-violet-500/25">
                  <Bot className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{persona.nome}</h2>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', persona.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600')} />
                    <span className="text-xs text-zinc-400">{persona.is_active ? 'Ativa' : 'Inativa'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Tom', value: persona.tom },
                  { label: 'Objetivo', value: persona.objetivo },
                  { label: 'Nicho', value: persona.nicho ?? '—' },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-500 mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-white capitalize">{item.value.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-violet-600/5 border border-violet-500/15 rounded-lg">
                <p className="text-xs text-zinc-400">
                  A persona IA é o agente que fala com seus leads no WhatsApp. Configure em{' '}
                  <strong className="text-violet-400">Configurações &rarr; IA</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-zinc-700 rounded-xl">
              <Bot className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm text-zinc-400">Persona IA não configurada</p>
              <p className="text-xs text-zinc-500 mt-1">Configure sua IA em Configurações &rarr; IA</p>
            </div>
          )}
        </div>
      )}

      {/* ── EVENTS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum evento registrado</p>
            </div>
          ) : events.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-3 h-3 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white capitalize">{ev.tipo}</span>
                  <span className="text-[10px] text-zinc-500">via {ev.canal}</span>
                </div>
                {ev.conteudo && (
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{ev.conteudo}</p>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0">
                {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
