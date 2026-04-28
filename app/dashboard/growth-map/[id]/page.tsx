'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter }                      from 'next/navigation'
import dynamic                                       from 'next/dynamic'
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, Zap, List,
  TrendingUp, Mail, MessageCircle, Users, Upload, X, Check, CornerDownRight,
} from 'lucide-react'
import type { GrowthNode, GrowthEdge, NodeResult } from '@/lib/growth-map-types'
import type { ExecutionRecord }                     from '@/lib/flow-engine/types'

// ─── Dynamic import — React Flow needs browser APIs ──────────────────────────

const GrowthCanvas = dynamic(() => import('./canvas'), {
  ssr:     false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={28} className="animate-spin text-violet-400" />
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapData {
  id: string; name: string; description: string; status: string
  nodes: GrowthNode[]; edges: GrowthEdge[]
}

type NodeStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logsToNodeStatuses(exec: ExecutionRecord): Record<string, NodeStatus> {
  return exec.logs.reduce<Record<string, NodeStatus>>((acc, log) => {
    acc[log.nodeId] = log.status as NodeStatus
    return acc
  }, {})
}

function logsToResults(exec: ExecutionRecord): Record<string, NodeResult> {
  return exec.logs.reduce<Record<string, NodeResult>>((acc, log) => {
    acc[log.nodeId] = {
      success: log.status === 'success',
      label:   log.message ?? (log.status === 'skipped' ? 'Pulado' : log.status === 'error' ? 'Erro' : 'Concluído'),
      output:  (log.output as Record<string, unknown>) ?? {},
      error:   log.status === 'error' ? (log.message ?? 'Erro') : undefined,
    }
    return acc
  }, {})
}

// ─── Execution result panel ───────────────────────────────────────────────────

function ExecutionPanel({
  exec,
  onClose,
}: {
  exec: ExecutionRecord
  onClose: () => void
}) {
  const out  = exec.output as Record<string, unknown> | null
  const steps    = (out?.stepsExecuted    as number) ?? exec.logs.length
  const actions  = (out?.actionsExecuted  as number) ?? 0
  const emails   = (out?.emailsSent       as number) ?? 0
  const whatsapp = (out?.whatsappSent     as number) ?? 0
  const clients  = (out?.clientsReached   as number) ?? (emails + whatsapp)
  const revenue  = (out?.revenueImpact    as number) ?? 0
  const errors   = exec.logs.filter(l => l.status === 'error').length
  const insights = (out?.insights as string[] | undefined) ?? []

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
      <div className={[
        'rounded-2xl border backdrop-blur-sm p-5 shadow-2xl',
        exec.status === 'completed'
          ? 'border-emerald-500/30 bg-zinc-900/95'
          : 'border-red-500/30 bg-zinc-900/95',
      ].join(' ')}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            {exec.status === 'completed'
              ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              : <AlertCircle  size={18} className="text-red-400 shrink-0" />
            }
            <p className="font-semibold text-white text-sm">
              {exec.status === 'completed' ? 'Fluxo executado com sucesso' : 'Fluxo finalizado com erros'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Passos"   value={String(steps)}   icon={<List size={10} />} />
          <Stat label="Ações"    value={String(actions)}  icon={<Zap size={10} />} />
          <Stat label="Emails"   value={String(emails)}   icon={<Mail size={10} />} accent={emails > 0} />
          <Stat label="WhatsApp" value={String(whatsapp)} icon={<MessageCircle size={10} />} accent={whatsapp > 0} />
          <Stat label="Alcance"  value={String(clients)}  icon={<Users size={10} />} />
          {revenue > 0 && (
            <Stat label="Potencial" value={fmtBRL(revenue)} icon={<TrendingUp size={10} />} accent />
          )}
        </div>

        {errors > 0 && (
          <p className="text-xs text-red-400 mb-2">{errors} passo(s) com erro — veja os logs abaixo</p>
        )}

        {/* AI Insights */}
        {insights.length > 0 && (
          <div className="mb-3 rounded-lg bg-violet-600/10 border border-violet-600/20 px-3 py-2">
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Zap size={9} /> Insights do fluxo
            </p>
            <ul className="space-y-0.5">
              {insights.slice(0, 4).map((ins, i) => (
                <li key={i} className="text-[11px] text-zinc-400 flex gap-1">
                  <span className="text-violet-500 shrink-0">•</span>
                  {ins}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step logs */}
        {exec.logs.length > 0 && (
          <details className="text-[10px] text-zinc-500 mt-2">
            <summary className="cursor-pointer flex items-center gap-1 hover:text-zinc-400">
              <List size={10} /> Ver log detalhado ({exec.logs.length} passos)
            </summary>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
              {exec.logs.map((log, i) => (
                <div key={i} className={[
                  'flex gap-2 rounded px-2 py-1',
                  log.status === 'error'   ? 'bg-red-500/10 text-red-400'   :
                  log.status === 'skipped' ? 'bg-zinc-800 text-zinc-600'     :
                                             'bg-zinc-800/50 text-zinc-400',
                ].join(' ')}>
                  <span className="shrink-0">
                    {log.status === 'error' ? <X size={12} /> : log.status === 'skipped' ? <CornerDownRight size={12} /> : <Check size={12} />}
                  </span>
                  <span className="truncate">[{log.nodeType}] {log.message}</span>
                  <span className="ml-auto shrink-0">{log.durationMs}ms</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function Stat({
  label, value, accent = false, icon,
}: {
  label: string; value: string; accent?: boolean; icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-zinc-800/60 px-3 py-2 text-center">
      <p className={['text-sm font-bold', accent ? 'text-violet-400' : 'text-white'].join(' ')}>{value}</p>
      <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-0.5 mt-0.5">{icon}{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthMapDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [map,          setMap]          = useState<MapData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [executing,    setExecuting]    = useState(false)
  const [execResult,   setExecResult]   = useState<ExecutionRecord | null>(null)
  const [execError,    setExecError]    = useState('')
  const [nodeStatuses,    setNodeStatuses]    = useState<Record<string, NodeStatus>>({})
  const [nodeResults,     setNodeResults]     = useState<Record<string, NodeResult> | null>(null)
  const [showSaveAsModal, setShowSaveAsModal] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/growth-maps/${id}`)
      const data = await res.json() as {
        map?: MapData
        lastExecution?: ExecutionRecord | null
        error?: string
      }
      if (!res.ok) { setError(data.error ?? 'Erro ao carregar mapa'); return }
      setMap(data.map ?? null)
      // Show last completed execution on first load (don't overwrite a live result)
      if (data.lastExecution && !execResult) {
        const exec = data.lastExecution
        if (exec.status === 'completed' || exec.status === 'error') {
          setExecResult(exec)
          setNodeResults(logsToResults(exec))
          setNodeStatuses(logsToNodeStatuses(exec))
        }
      }
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => stopPolling, [])   // cleanup on unmount

  // ─── Save handler ────────────────────────────────────────────────────────────

  async function handleSave(nodes: GrowthNode[], edges: GrowthEdge[]) {
    setSaving(true)
    try {
      await fetch(`/api/growth-maps/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nodes, edges }),
      })
      setMap(prev => prev ? { ...prev, nodes, edges } : prev)
    } finally { setSaving(false) }
  }

  // ─── Execute handler ─────────────────────────────────────────────────────────

  async function handleExecute() {
    setExecuting(true)
    setExecError('')
    setExecResult(null)
    setNodeStatuses({})
    setNodeResults(null)
    stopPolling()

    try {
      // 1. Start execution
      const execRes  = await fetch(`/api/growth-maps/${id}/execute`, { method: 'POST' })
      const execData = await execRes.json() as { executionId?: string; error?: string }

      if (!execRes.ok || !execData.executionId) {
        setExecError(execData.error ?? 'Erro ao executar fluxo')
        return
      }

      const executionId = execData.executionId

      // 2. Poll every 800ms until completed/error
      const poll = async () => {
        const statusRes  = await fetch(`/api/growth-maps/${id}/executions/${executionId}`)
        const statusData = await statusRes.json() as { execution?: ExecutionRecord }
        const exec       = statusData.execution

        if (!exec) return

        // Live update node colors
        setNodeStatuses(logsToNodeStatuses(exec))

        if (exec.status === 'completed' || exec.status === 'error') {
          stopPolling()
          setExecResult(exec)
          setNodeResults(logsToResults(exec))
          if (exec.status === 'error') {
            const out = exec.output as Record<string, unknown> | null
            setExecError((out?.error as string) ?? 'Erro na execução')
          }
          void load()
        }
      }

      // Run first poll immediately, then interval
      await poll()
      pollingRef.current = setInterval(() => { void poll() }, 800)

    } catch (err) {
      setExecError(String(err))
    } finally {
      setExecuting(false)
    }
  }

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    )
  }

  if (error || !map) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-zinc-400">{error || 'Mapa não encontrado'}</p>
        <button onClick={() => router.push('/dashboard/growth-map')}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">
          Voltar
        </button>
      </div>
    )
  }

  // ─── Canvas page ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 shrink-0">
        <button onClick={() => router.push('/dashboard/growth-map')}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{map.name}</h1>
          <p className="text-[10px] text-zinc-500">
            {map.nodes.length} blocos · {map.edges.length} conexões
          </p>
        </div>
        <span className={[
          'text-[10px] px-2 py-0.5 rounded-full font-medium',
          map.status === 'active'
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-zinc-700 text-zinc-400',
        ].join(' ')}>
          {map.status === 'active' ? '● Ativo' : '◯ Rascunho'}
        </span>
        <button
          onClick={() => setShowSaveAsModal(true)}
          title="Salvar como template"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition-colors">
          <Upload size={14} />
        </button>
      </div>

      {/* Exec error banner */}
      {execError && (
        <div className="flex items-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-xs text-red-400 shrink-0">
          <AlertCircle size={12} />
          {execError}
          <button className="ml-auto text-red-500 hover:text-red-300" onClick={() => setExecError('')}>×</button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <GrowthCanvas
          mapId={id}
          initialNodes={map.nodes}
          initialEdges={map.edges}
          onSave={handleSave}
          onExecute={handleExecute}
          executing={executing}
          saving={saving}
          results={nodeResults}
          nodeStatuses={Object.keys(nodeStatuses).length > 0 ? nodeStatuses : undefined}
        />

        {execResult && (
          <ExecutionPanel
            exec={execResult}
            onClose={() => {
              setExecResult(null)
              setNodeStatuses({})
              setNodeResults(null)
            }}
          />
        )}
      </div>

      {/* Save as Template modal */}
      {showSaveAsModal && map && (
        <SaveAsTemplateModal
          map={map}
          onClose={() => setShowSaveAsModal(false)}
        />
      )}
    </div>
  )
}

// ─── Save as Template Modal ───────────────────────────────────────────────────

function SaveAsTemplateModal({
  map,
  onClose,
}: {
  map: { name: string; description: string; nodes: GrowthNode[]; edges: GrowthEdge[] }
  onClose: () => void
}) {
  const CATEGORIES = [
    { key: 'general',      label: 'Geral'       },
    { key: 'recovery',     label: 'Recuperação' },
    { key: 'reactivation', label: 'Reativação'  },
    { key: 'upsell',       label: 'Upsell'      },
    { key: 'sales',        label: 'Vendas'      },
    { key: 'retention',    label: 'Retenção'    },
    { key: 'onboarding',   label: 'Onboarding'  },
  ]

  const [name,     setName]     = useState(map.name)
  const [desc,     setDesc]     = useState(map.description)
  const [category, setCategory] = useState('general')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/flow-templates', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), description: desc.trim(), category,
        nodes: map.nodes, edges: map.edges,
      }),
    })
    const data = await res.json() as { error?: string }
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
    setSaved(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-violet-400" />
            <h2 className="text-base font-bold text-white">Salvar como template</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800">
            <X size={14} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={32} className="text-emerald-400" />
            <p className="text-white font-semibold">Template publicado!</p>
            <p className="text-xs text-zinc-500">Disponível no marketplace da comunidade.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do template *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Descrição</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <p className="text-[10px] text-zinc-500 mb-4">
              Este template ficará visível publicamente no marketplace para outros usuários importarem.
            </p>

            <button onClick={() => void handleSave()} disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {saving ? 'Publicando…' : 'Publicar no marketplace'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
