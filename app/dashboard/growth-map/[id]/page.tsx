'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter }             from 'next/navigation'
import dynamic                              from 'next/dynamic'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import type { GrowthNode, GrowthEdge, NodeResult } from '@/lib/growth-map-engine'

// ─── Dynamic import — React Flow needs browser APIs ──────────────────────────

const GrowthCanvas = dynamic(() => import('./canvas'), { ssr: false,
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

interface LastExecution {
  id: string; summary: string; actions_taken: number; created_at: string
  results: Record<string, NodeResult>
}

// ─── Execution result panel ───────────────────────────────────────────────────

function ExecutionPanel({
  exec,
  onClose,
}: {
  exec: { summary: string; actionsTaken: number; results: Record<string, NodeResult> }
  onClose: () => void
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-2xl border border-emerald-500/30 bg-zinc-900/95 backdrop-blur-sm p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <p className="font-semibold text-white text-sm">Fluxo executado com sucesso</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
        </div>
        <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{exec.summary}</p>
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-violet-400" />
          <span className="text-xs text-violet-300 font-medium">{exec.actionsTaken} ação(ões) disparada(s)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthMapDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [map,       setMap]       = useState<MapData | null>(null)
  const [lastExec,  setLastExec]  = useState<LastExecution | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [saving,    setSaving]    = useState(false)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<{
    summary: string; actionsTaken: number; results: Record<string, NodeResult>
  } | null>(null)
  const [execError,  setExecError]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/growth-maps/${id}`)
      const data = await res.json() as {
        map?: MapData; lastExecution?: LastExecution; error?: string
      }
      if (!res.ok) { setError(data.error ?? 'Erro ao carregar mapa'); return }
      setMap(data.map ?? null)
      setLastExec(data.lastExecution ?? null)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleSave(nodes: GrowthNode[], edges: GrowthEdge[]) {
    setSaving(true)
    try {
      await fetch(`/api/growth-maps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      })
      // update local map
      setMap(prev => prev ? { ...prev, nodes, edges } : prev)
    } finally { setSaving(false) }
  }

  async function handleExecute() {
    setExecuting(true)
    setExecError('')
    setExecResult(null)
    try {
      const res  = await fetch(`/api/growth-maps/${id}/execute`, { method: 'POST' })
      const data = await res.json() as {
        results?: Record<string, NodeResult>
        summary?: string
        actionsTaken?: number
        error?: string
      }
      if (!res.ok) {
        setExecError(data.error ?? 'Erro ao executar fluxo')
        return
      }
      setExecResult({
        results:      data.results ?? {},
        summary:      data.summary ?? 'Fluxo concluído.',
        actionsTaken: data.actionsTaken ?? 0,
      })
      // refresh last exec header badge
      void load()
    } finally { setExecuting(false) }
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
          {lastExec && (
            <p className="text-[10px] text-zinc-500">
              Última execução: {new Date(lastExec.created_at).toLocaleString('pt-BR')}
              {' · '}{lastExec.actions_taken} ação(ões) disparada(s)
            </p>
          )}
        </div>

        <span className={[
          'text-[10px] px-2 py-0.5 rounded-full font-medium',
          map.status === 'active'
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-zinc-700 text-zinc-400',
        ].join(' ')}>
          {map.status === 'active' ? '● Ativo' : '◯ Rascunho'}
        </span>
      </div>

      {/* Exec error banner */}
      {execError && (
        <div className="flex items-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-xs text-red-400 shrink-0">
          <AlertCircle size={12} />
          {execError}
          <button className="ml-auto text-red-500 hover:text-red-300" onClick={() => setExecError('')}>×</button>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <GrowthCanvas
          mapId={id}
          initialNodes={map.nodes}
          initialEdges={map.edges}
          onSave={handleSave}
          onExecute={handleExecute}
          executing={executing}
          saving={saving}
          results={execResult?.results ?? (lastExec?.results ?? null)}
        />

        {execResult && (
          <ExecutionPanel
            exec={execResult}
            onClose={() => setExecResult(null)}
          />
        )}
      </div>
    </div>
  )
}
