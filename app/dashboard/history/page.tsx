'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  History, Mail, MessageSquare, Megaphone, ClipboardList,
  LineChart, Loader2, TrendingUp, AlertCircle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────

interface HistoryItem {
  id: string
  titulo: string
  execution_type: string
  ganho_realizado: number
  execution_log: string | null
  executed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${Math.round(v)}`
}

function typeIcon(type: string) {
  switch (type) {
    case 'email': return <Mail size={15} className="text-blue-400" />
    case 'whatsapp': return <MessageSquare size={15} className="text-emerald-400" />
    case 'ads': return <Megaphone size={15} className="text-orange-400" />
    case 'recommendation': return <ClipboardList size={15} className="text-violet-400" />
    case 'analytics': return <LineChart size={15} className="text-cyan-400" />
    default: return <TrendingUp size={15} className="text-zinc-400" />
  }
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    email: 'E-mail', whatsapp: 'WhatsApp', ads: 'Ads',
    recommendation: 'Recomendação', analytics: 'Análise',
  }
  return map[type] ?? type
}

// ─── Page ─────────────────────────────────────────────────────

export default function HistoryPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexus_session')
      if (raw) {
        const s = JSON.parse(raw) as { company_id?: string; companyId?: string }
        setCompanyId(s.company_id ?? s.companyId ?? null)
      }
    } catch { /* ok */ }
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/execution-history?company_id=${companyId}`)
      const json = await res.json() as { data?: HistoryItem[] }
      if (json.data) setItems(json.data)
    } catch { /* ok */ } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) fetchHistory()
  }, [companyId, fetchHistory])

  const totalGanho = items.reduce((s, i) => s + (i.ganho_realizado ?? 0), 0)

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-500 text-sm">Sessão não encontrada.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <History size={22} className="text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Histórico de Execuções</h1>
        </div>
        <p className="text-zinc-500 text-sm">Todas as ações executadas e seus resultados.</p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Ações Executadas</p>
          <p className="text-xl font-bold text-violet-400">{items.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Ganho Total Realizado</p>
          <p className="text-xl font-bold text-emerald-400">{fmtBRL(totalGanho)}</p>
        </div>
      </div>

      {/* Refresh */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
          <History size={36} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">Nenhuma ação executada ainda.</p>
          <p className="text-xs text-zinc-600 mt-1">Vá para Ações e execute as recomendações da IA.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors"
              >
                <span className="shrink-0">{typeIcon(item.execution_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.titulo}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-zinc-500">{typeLabel(item.execution_type)}</span>
                    <span className="text-[11px] text-zinc-600">
                      {new Date(item.executed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-400">
                  + {fmtBRL(item.ganho_realizado)}
                </span>
              </button>

              {expanded === item.id && item.execution_log && (
                <div className="px-5 pb-4">
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-3">
                    <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wide mb-2">Log de execução</p>
                    <p className="text-[11px] font-mono text-zinc-400 break-all">{item.execution_log}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
