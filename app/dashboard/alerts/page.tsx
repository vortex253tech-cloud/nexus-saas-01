'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, TrendingUp, Info, ShieldAlert,
  CheckCircle2, Loader2, RefreshCw, AlertCircle, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getString, isRecord } from '@/lib/unknown'

// ─── Types ────────────────────────────────────────────────────

interface Alert {
  id: string
  tipo: 'perigo' | 'atencao' | 'oportunidade' | 'info'
  titulo: string
  descricao: string | null
  impacto: string | null
  lido: boolean
  dismissed: boolean
  created_at: string
}

function isAlert(value: unknown): value is Alert {
  if (!isRecord(value)) return false
  const tipo = getString(value, 'tipo')
  return (
    typeof value.id === 'string' &&
    (tipo === 'perigo' || tipo === 'atencao' || tipo === 'oportunidade' || tipo === 'info') &&
    typeof value.titulo === 'string' &&
    (typeof value.descricao === 'string' || value.descricao === null) &&
    (typeof value.impacto === 'string' || value.impacto === null) &&
    typeof value.lido === 'boolean' &&
    typeof value.dismissed === 'boolean' &&
    typeof value.created_at === 'string'
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function alertConfig(tipo: string) {
  switch (tipo) {
    case 'perigo':
      return {
        icon: <ShieldAlert size={18} />,
        color: 'text-red-400',
        bg: 'bg-red-400/10',
        border: 'border-red-400/30',
        badge: 'bg-red-400/15 text-red-400 border-red-400/30',
        label: 'Perigo',
      }
    case 'atencao':
      return {
        icon: <AlertTriangle size={18} />,
        color: 'text-orange-400',
        bg: 'bg-orange-400/10',
        border: 'border-orange-400/30',
        badge: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
        label: 'Atenção',
      }
    case 'oportunidade':
      return {
        icon: <TrendingUp size={18} />,
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        border: 'border-emerald-400/30',
        badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
        label: 'Oportunidade',
      }
    default:
      return {
        icon: <Info size={18} />,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400/30',
        badge: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
        label: 'Info',
      }
  }
}

// ─── Alert Card ───────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
  onRead,
}: {
  alert: Alert
  onDismiss: (id: string) => void
  onRead: (id: string) => void
}) {
  const cfg = alertConfig(alert.tipo)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      onClick={() => !alert.lido && onRead(alert.id)}
      className={cn(
        'relative rounded-xl border p-5 transition-all cursor-pointer',
        alert.lido ? 'border-zinc-800/40 bg-zinc-900/40 opacity-75' : `${cfg.border} ${cfg.bg}`,
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(alert.id) }}
        className="absolute right-3 top-3 rounded-full p-1 text-zinc-600 hover:text-white hover:bg-zinc-800"
      >
        <X size={12} />
      </button>

      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 shrink-0', cfg.color)}>{cfg.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', cfg.badge)}>
              {cfg.label}
            </span>
            {!alert.lido && (
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            )}
          </div>
          <h3 className="font-semibold text-sm text-white mb-1">{alert.titulo}</h3>
          {alert.descricao && (
            <p className="text-xs text-zinc-500 mb-2">{alert.descricao}</p>
          )}
          {alert.impacto && (
            <span className="inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
              {alert.impacto}
            </span>
          )}
          <p className="mt-2 text-[11px] text-zinc-600">
            {new Date(alert.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {!alert.lido && <span className="ml-2 text-zinc-500">· Clique para marcar como lido</span>}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function AlertsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus_resultado')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isRecord(parsed)) setCompanyId(getString(parsed, 'company_id') ?? getString(parsed, 'companyId') ?? null)
      }
    } catch { /* ok */ }
  }, [])

  const fetchAlerts = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/alerts?company_id=${companyId}`)
      const json: unknown = await res.json()
      if (isRecord(json) && Array.isArray(json.data)) setAlerts(json.data.filter(isAlert))
    } catch { /* ok */ } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) fetchAlerts()
  }, [companyId, fetchAlerts])

  async function handleDismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true }),
    })
  }

  async function handleRead(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a))
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, lido: true }),
    })
  }

  const unread = alerts.filter(a => !a.lido).length
  const perigoCount = alerts.filter(a => a.tipo === 'perigo').length
  const oportunidadeCount = alerts.filter(a => a.tipo === 'oportunidade').length

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
          <Bell size={22} className="text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Alertas</h1>
          {unread > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-sm">Avisos críticos e oportunidades detectadas pelo sistema.</p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Não lidos', value: unread, color: 'text-violet-400' },
          { label: 'Perigos', value: perigoCount, color: 'text-red-400' },
          { label: 'Oportunidades', value: oportunidadeCount, color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
            <p className={cn('text-xl font-bold', c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={fetchAlerts}
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
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">Nenhum alerta ativo. Tudo em ordem!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
                onRead={handleRead}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
