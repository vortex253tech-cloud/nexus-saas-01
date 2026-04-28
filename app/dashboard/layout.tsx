'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Database, Zap, Bell, History,
  CreditCard, Menu, X, Building2, ChevronRight,
  DollarSign, MessageSquare, LogOut, Users, Clock,
  ArrowRight, Mail, FolderOpen, Map, Settings,
  TrendingUp, AlertTriangle, Loader2, RefreshCw,
  CheckCircle2, AlertCircle, ExternalLink, Activity,
  Moon, Sun, Palette,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth-provider'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Nav ───────────────────────────────────────────────────────

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',          icon: LayoutDashboard, exact: true },
  { href: '/dashboard/financeiro', label: 'Financeiro',         icon: DollarSign },
  { href: '/dashboard/clients',    label: 'Clientes',           icon: Users },
  { href: '/dashboard/messages',   label: 'Mensagens',          icon: Mail },
  { href: '/dashboard/projects',   label: 'Projetos',           icon: FolderOpen },
  { href: '/dashboard/growth-map', label: 'Mapa de Crescimento',icon: Map },
  { href: '/dashboard/assistant',  label: 'Assistente IA',      icon: MessageSquare },
  { href: '/dashboard/dados',      label: 'Dados',              icon: Database },
  { href: '/dashboard/actions',    label: 'Ações',              icon: Zap },
  { href: '/dashboard/alerts',     label: 'Alertas',            icon: Bell },
  { href: '/dashboard/history',    label: 'Histórico',          icon: History },
  { href: '/dashboard/billing',    label: 'Plano',              icon: CreditCard },
  { href: '/dashboard/settings',   label: 'Configurações',      icon: Settings },
]

// ─── Quick Drawer Types ─────────────────────────────────────────

type DrawerType = 'growth' | 'alerts' | 'financial' | 'notifications' | 'settings'

interface TrialInfo {
  isTrialActive: boolean
  trialDaysLeft: number | null
  effectivePlan: string
}

// ─── Drawer Sub-components ──────────────────────────────────────

function DrawerLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
      <Loader2 size={20} className="animate-spin text-violet-400" />
      <p className="text-xs">Carregando...</p>
    </div>
  )
}

function DrawerEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600">
      <CheckCircle2 size={24} className="text-zinc-700" />
      <p className="text-sm text-center">{message}</p>
    </div>
  )
}

function DrawerShell({
  title,
  icon,
  href,
  hrefLabel = 'Ver tudo',
  onClose,
  onRefresh,
  children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  hrefLabel?: string
  onClose: () => void
  onRefresh?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {icon}
          <h2 className="text-sm font-bold text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {children}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-800/70 px-5 py-3">
        <Link
          href={href}
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
        >
          <ExternalLink size={11} />
          {hrefLabel}
        </Link>
      </div>
    </div>
  )
}

// ─── Growth Panel ───────────────────────────────────────────────

interface AIAction {
  id?: string
  title?: string
  description?: string
  priority?: string
  estimated_impact?: string | number
  category?: string
  status?: string
}

function GrowthPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<AIAction[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/actions?company_id=${companyId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((j: { data?: AIAction[] }) => setData(j.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => { load() }, [load])

  const priorityBadge = (p?: string) => {
    if (!p) return null
    const map: Record<string, string> = {
      high:     'bg-red-500/20 text-red-400 border-red-500/20',
      critical: 'bg-red-500/20 text-red-400 border-red-500/20',
      medium:   'bg-amber-500/20 text-amber-400 border-amber-500/20',
      low:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    }
    return (
      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', map[p] ?? 'bg-zinc-700 text-zinc-400 border-zinc-600')}>
        {p}
      </span>
    )
  }

  return (
    <DrawerShell
      title="Insights de Crescimento"
      icon={<TrendingUp size={15} className="text-emerald-400" />}
      href="/dashboard/growth-map"
      hrefLabel="Abrir Mapa de Crescimento"
      onClose={onClose}
      onRefresh={load}
    >
      {loading ? <DrawerLoader /> : data.length === 0 ? (
        <DrawerEmpty message="Nenhum insight disponível. Adicione dados financeiros para a IA gerar recomendações." />
      ) : (
        <ul className="space-y-3">
          {data.slice(0, 10).map((a, i) => (
            <li key={a.id ?? i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-1.5 transition hover:border-zinc-700">
              <p className="text-sm font-medium text-white leading-snug">{a.title ?? 'Ação recomendada'}</p>
              {a.description && (
                <p className="text-xs text-zinc-400 leading-relaxed">{a.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {priorityBadge(a.priority)}
                {a.estimated_impact != null && (
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {typeof a.estimated_impact === 'number'
                      ? `+R$ ${a.estimated_impact.toLocaleString('pt-BR')}`
                      : a.estimated_impact}
                  </span>
                )}
                {a.category && (
                  <span className="text-[10px] text-zinc-600">{a.category}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}

// ─── Alerts Panel ───────────────────────────────────────────────

interface AlertRow {
  id?: string
  message?: string
  severity?: string
  type?: string
  lido?: boolean
  created_at?: string
}

function AlertsPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/alerts?company_id=${companyId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((j: { data?: AlertRow[] }) => setData(j.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => { load() }, [load])

  const severityStyle = (s?: string) => {
    if (s === 'critical') return { icon: <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />, border: 'border-red-500/30 bg-red-500/5' }
    if (s === 'warning')  return { icon: <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />, border: 'border-amber-500/20 bg-amber-500/5' }
    return { icon: <Activity size={13} className="text-blue-400 shrink-0 mt-0.5" />, border: 'border-zinc-700 bg-zinc-900/40' }
  }

  const sorted = [...data].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
  })

  return (
    <DrawerShell
      title="Alertas Ativos"
      icon={<AlertTriangle size={15} className="text-amber-400" />}
      href="/dashboard/alerts"
      hrefLabel="Ver todos os alertas"
      onClose={onClose}
      onRefresh={load}
    >
      {loading ? <DrawerLoader /> : sorted.length === 0 ? (
        <DrawerEmpty message="Nenhum alerta ativo. O sistema está monitorando continuamente." />
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500">{sorted.length} alerta{sorted.length !== 1 ? 's' : ''} ativo{sorted.length !== 1 ? 's' : ''}</p>
          <ul className="space-y-2.5">
            {sorted.map((a, i) => {
              const { icon, border } = severityStyle(a.severity)
              return (
                <li key={a.id ?? i} className={cn('rounded-xl border p-3 flex gap-2.5', border)}>
                  {icon}
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed text-zinc-200">{a.message ?? 'Alerta detectado'}</p>
                    {a.created_at && (
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </DrawerShell>
  )
}

// ─── Financial Panel ────────────────────────────────────────────

interface FinRow {
  id?: string
  revenue?: number
  costs?: number
  profit?: number
  period_label?: string
  period_date?: string
  note?: string
}

function FinancialPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<FinRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/financial-data?company_id=${companyId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((j: { data?: FinRow[] }) => setData(j.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => { load() }, [load])

  const fmt = (n?: number) => n != null
    ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—'

  const totRevenue = data.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const totCosts   = data.reduce((s, r) => s + (r.costs ?? 0), 0)
  const totProfit  = data.reduce((s, r) => s + (r.profit ?? 0), 0)

  const latest = data[0]

  return (
    <DrawerShell
      title="Resumo Financeiro"
      icon={<DollarSign size={15} className="text-violet-400" />}
      href="/dashboard/financeiro"
      hrefLabel="Ver financeiro completo"
      onClose={onClose}
      onRefresh={load}
    >
      {loading ? <DrawerLoader /> : data.length === 0 ? (
        <DrawerEmpty message="Nenhum dado financeiro cadastrado ainda." />
      ) : (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Receita', value: fmt(totRevenue), color: 'text-emerald-400', glow: 'rgba(52,211,153,0.4)' },
              { label: 'Custos',  value: fmt(totCosts),   color: 'text-red-400',     glow: 'rgba(248,113,113,0.4)' },
              { label: 'Lucro',   value: fmt(totProfit),  color: totProfit >= 0 ? 'text-violet-400' : 'text-red-400', glow: totProfit >= 0 ? 'rgba(124,58,237,0.4)' : 'rgba(248,113,113,0.4)' },
            ].map(k => (
              <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
                <p className="text-[10px] text-zinc-500 mb-1">{k.label}</p>
                <p
                  className={cn('text-xs font-bold leading-tight', k.color)}
                  style={{ textShadow: `0 0 10px ${k.glow}` }}
                >
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {/* Latest period */}
          {latest && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Período mais recente</p>
              <p className="text-sm font-semibold text-white">{latest.period_label ?? '—'}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Receita</span>
                  <span className="text-emerald-400 font-medium">{fmt(latest.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Custos</span>
                  <span className="text-red-400 font-medium">{fmt(latest.costs)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-zinc-800 pt-1 mt-1">
                  <span className="text-zinc-400 font-semibold">Lucro</span>
                  <span className={cn('font-bold', (latest.profit ?? 0) >= 0 ? 'text-violet-400' : 'text-red-400')}>
                    {fmt(latest.profit)}
                  </span>
                </div>
              </div>
              {latest.note && (
                <p className="mt-2 text-[11px] text-zinc-600 italic">{latest.note}</p>
              )}
            </div>
          )}

          {/* History list */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Histórico ({data.length} períodos)</p>
            <ul className="space-y-1.5">
              {data.slice(0, 6).map((r, i) => (
                <li key={r.id ?? i} className="flex items-center justify-between rounded-lg border border-zinc-800/50 px-3 py-2">
                  <span className="text-xs text-zinc-400">{r.period_label ?? '—'}</span>
                  <span className={cn('text-xs font-semibold', (r.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmt(r.profit)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DrawerShell>
  )
}

// ─── Notifications Panel ────────────────────────────────────────

interface ExecRow {
  id?: string
  titulo?: string
  execution_type?: string
  ganho_realizado?: number
  executed_at?: string
}

function NotificationsPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<ExecRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/execution-history?company_id=${companyId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((j: { data?: ExecRow[] }) => setData(j.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => { load() }, [load])

  const typeIcon = (t?: string) => {
    if (t === 'action')     return <Zap size={11} className="text-violet-400" />
    if (t === 'automation') return <RefreshCw size={11} className="text-blue-400" />
    if (t === 'alert')      return <AlertTriangle size={11} className="text-amber-400" />
    return <Activity size={11} className="text-zinc-400" />
  }

  return (
    <DrawerShell
      title="Eventos Recentes"
      icon={<Bell size={15} className="text-blue-400" />}
      href="/dashboard/history"
      hrefLabel="Ver histórico completo"
      onClose={onClose}
      onRefresh={load}
    >
      {loading ? <DrawerLoader /> : data.length === 0 ? (
        <DrawerEmpty message="Nenhum evento registrado ainda." />
      ) : (
        <ul className="space-y-2.5">
          {data.slice(0, 15).map((e, i) => (
            <li key={e.id ?? i} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                {typeIcon(e.execution_type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200 leading-snug truncate">{e.titulo ?? 'Evento executado'}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {e.ganho_realizado != null && e.ganho_realizado > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-400"
                      style={{ textShadow: '0 0 8px rgba(52,211,153,0.4)' }}>
                      +R$ {e.ganho_realizado.toLocaleString('pt-BR')}
                    </span>
                  )}
                  {e.executed_at && (
                    <span className="text-[10px] text-zinc-600">
                      {new Date(e.executed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}

// ─── Settings Panel ─────────────────────────────────────────────

const QUICK_THEMES = [
  { key: 'default', name: 'Nexus Dark',   color: '#7c3aed' },
  { key: 'emerald', name: 'Emerald Pro',  color: '#10b981' },
  { key: 'ocean',   name: 'Ocean Blue',   color: '#3b82f6' },
  { key: 'rose',    name: 'Rose Gold',    color: '#f43f5e' },
]

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default'
    return localStorage.getItem('nexus_theme') ?? 'default'
  })

  function applyTheme(key: string) {
    setActiveTheme(key)
    localStorage.setItem('nexus_theme', key)
    // Dispatch custom event so settings page stays in sync
    window.dispatchEvent(new CustomEvent('nexus-theme-change', { detail: key }))
    // Apply CSS variable immediately
    const theme = QUICK_THEMES.find(t => t.key === key)
    if (theme) {
      document.documentElement.style.setProperty('--nexus-primary', theme.color)
    }
    // Persist to server
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeKey: key }),
    }).catch(() => {/* ok */})
  }

  const links = [
    { href: '/dashboard/settings',  label: 'Configurações gerais', icon: <Settings size={13} className="text-zinc-400" /> },
    { href: '/dashboard/billing',   label: 'Gerenciar plano',      icon: <CreditCard size={13} className="text-violet-400" /> },
    { href: '/dashboard/dados',     label: 'Dados financeiros',    icon: <Database size={13} className="text-blue-400" /> },
  ]

  return (
    <DrawerShell
      title="Configurações Rápidas"
      icon={<Settings size={15} className="text-zinc-300" />}
      href="/dashboard/settings"
      hrefLabel="Abrir configurações completas"
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Theme picker */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tema</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_THEMES.map(t => (
              <button
                key={t.key}
                onClick={() => applyTheme(t.key)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                  activeTheme === t.key
                    ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/60',
                )}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color, boxShadow: activeTheme === t.key ? `0 0 8px ${t.color}` : 'none' }}
                />
                <span className="text-xs font-medium text-zinc-300 leading-tight">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Acesso Rápido</p>
          <ul className="space-y-1.5">
            {links.map(l => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-3 transition hover:border-zinc-700 hover:bg-zinc-800/60"
                >
                  {l.icon}
                  <span className="text-xs text-zinc-300">{l.label}</span>
                  <ChevronRight size={12} className="ml-auto text-zinc-600" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Display info */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Sistema</p>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ai-pulse" />
            <span className="text-xs text-zinc-400">IA Ativa — Monitoramento em tempo real</span>
          </div>
          <div className="flex items-center gap-2">
            <Moon size={11} className="text-zinc-600" />
            <span className="text-xs text-zinc-500">Modo escuro · NEXUS v2</span>
          </div>
        </div>
      </div>
    </DrawerShell>
  )
}

// ─── Quick Drawer Overlay ───────────────────────────────────────

const QUICK_BUTTONS: Array<{
  id: DrawerType
  icon: React.ElementType
  label: string
  activeColor: string
  glowColor: string
}> = [
  { id: 'growth',        icon: TrendingUp,    label: 'Crescimento', activeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', glowColor: 'hover:shadow-emerald-500/25' },
  { id: 'alerts',        icon: AlertTriangle, label: 'Alertas',     activeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',       glowColor: 'hover:shadow-amber-500/25' },
  { id: 'financial',     icon: DollarSign,    label: 'Financeiro',  activeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/30',     glowColor: 'hover:shadow-violet-500/25' },
  { id: 'notifications', icon: Bell,          label: 'Eventos',     activeColor: 'text-blue-400 bg-blue-500/15 border-blue-500/30',           glowColor: 'hover:shadow-blue-500/25' },
  { id: 'settings',      icon: Settings,      label: 'Config',      activeColor: 'text-zinc-200 bg-zinc-700/60 border-zinc-600/50',           glowColor: 'hover:shadow-zinc-500/20' },
]

function QuickAccessBar({
  active,
  onSelect,
}: {
  active: DrawerType | null
  onSelect: (id: DrawerType) => void
}) {
  return (
    <div className="mx-3 mb-2">
      <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Acesso rápido</p>
      <div className="flex items-center justify-between gap-1">
        {QUICK_BUTTONS.map(btn => {
          const isActive = active === btn.id
          return (
            <motion.button
              key={btn.id}
              onClick={() => onSelect(btn.id)}
              whileHover={{ y: -1, scale: 1.06 }}
              whileTap={{ scale: 0.93 }}
              title={btn.label}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 transition-all duration-200',
                'shadow-sm hover:shadow-md',
                btn.glowColor,
                isActive
                  ? btn.activeColor
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-600 hover:border-zinc-700 hover:text-zinc-300',
              )}
            >
              <btn.icon size={13} />
              <span className="text-[8px] font-medium leading-none">{btn.label}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function QuickDrawerOverlay({
  type,
  companyId,
  onClose,
}: {
  type: DrawerType | null
  companyId: string | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {type && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col border-l border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60"
          >
            {companyId ? (
              <>
                {type === 'growth'        && <GrowthPanel        companyId={companyId} onClose={onClose} />}
                {type === 'alerts'        && <AlertsPanel        companyId={companyId} onClose={onClose} />}
                {type === 'financial'     && <FinancialPanel     companyId={companyId} onClose={onClose} />}
                {type === 'notifications' && <NotificationsPanel companyId={companyId} onClose={onClose} />}
                {type === 'settings'      && <SettingsPanel      onClose={onClose} />}
              </>
            ) : (
              <>
                {type === 'settings' && <SettingsPanel onClose={onClose} />}
                {type !== 'settings' && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600 p-8 text-center">
                    <Loader2 size={20} className="animate-spin text-violet-400" />
                    <p className="text-sm">Carregando dados da empresa...</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Trial Banner ──────────────────────────────────────────────

function TrialBanner({ trial }: { trial: TrialInfo }) {
  if (!trial.isTrialActive || trial.trialDaysLeft === null) return null

  const urgent = trial.trialDaysLeft <= 2

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-2.5 border-b text-xs',
      urgent
        ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
        : 'bg-violet-500/10 border-violet-500/30 text-violet-300',
    )}>
      <div className="flex items-center gap-2">
        <Clock size={12} className="shrink-0" />
        <span>
          {urgent
            ? `Trial expira em ${trial.trialDaysLeft} dia${trial.trialDaysLeft !== 1 ? 's' : ''}!`
            : `Trial: ${trial.trialDaysLeft} dias restantes — todos os recursos PRO liberados`}
        </span>
      </div>
      <Link
        href="/dashboard/billing"
        className={cn(
          'flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap transition-colors',
          urgent
            ? 'bg-orange-500 text-white hover:bg-orange-400'
            : 'bg-violet-600 text-white hover:bg-violet-500',
        )}
      >
        Ativar plano <ArrowRight size={10} />
      </Link>
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────

function Sidebar({
  open,
  onClose,
  trial,
  activeDrawer,
  onDrawerSelect,
}: {
  open: boolean
  onClose: () => void
  trial: TrialInfo
  activeDrawer: DrawerType | null
  onDrawerSelect: (id: DrawerType) => void
}) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa')
  const [userEmail,   setUserEmail]   = useState('')

  useEffect(() => {
    if (user?.email) setUserEmail(user.email)
  }, [user])

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'company' in data) {
          const d = data as { company?: { name?: string } }
          if (d.company?.name) setNomeEmpresa(d.company.name)
        }
      })
      .catch(() => {
        try {
          const raw = sessionStorage.getItem('nexus_resultado')
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (typeof parsed.nomeEmpresa === 'string') setNomeEmpresa(parsed.nomeEmpresa)
          }
        } catch { /* ok */ }
      })
  }, [])

  function isActive(item: typeof NAV[number]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-zinc-950 border-r border-zinc-800/60',
        'transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white font-bold text-sm">N</div>
            <div>
              <p className="text-xs font-bold text-white tracking-wide">NEXUS</p>
              <p className="text-[10px] text-zinc-500 truncate max-w-[100px]">{nomeEmpresa}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Trial indicator */}
        {trial.isTrialActive && trial.trialDaysLeft !== null && (
          <div className="px-3 pt-3">
            <Link href="/dashboard/billing" className="flex items-center gap-2 rounded-lg bg-violet-600/15 border border-violet-600/30 px-3 py-2 hover:bg-violet-600/25 transition-colors">
              <Clock size={12} className="text-violet-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wide">Trial PRO</p>
                <p className="text-[11px] text-violet-400">{trial.trialDaysLeft} dias restantes</p>
              </div>
            </Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item)
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white border border-transparent',
                )}>
                <item.icon size={16} className={active ? 'text-violet-400' : 'text-zinc-500'} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight size={12} className="text-violet-400/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Quick Access Bar */}
        <QuickAccessBar active={activeDrawer} onSelect={onDrawerSelect} />

        {/* AI Active Indicator */}
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 ai-pulse shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">IA Ativa</p>
            <p className="truncate text-[10px] text-zinc-500">Monitorando continuamente</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800/60 space-y-2">
          {userEmail && (
            <p className="text-[10px] text-zinc-600 px-2 truncate">{userEmail}</p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
          <div className="flex items-center gap-2 px-2">
            <Building2 size={13} className="text-zinc-700" />
            <p className="text-[11px] text-zinc-700">COO de IA · NEXUS</p>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Layout ────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<DrawerType | null>(null)
  const [companyId,    setCompanyId]    = useState<string | null>(null)
  const [trial, setTrial] = useState<TrialInfo>({
    isTrialActive: false,
    trialDaysLeft: null,
    effectivePlan: 'free',
  })

  // Resolve company_id once on mount
  useEffect(() => {
    resolveCompanyId().then(cid => setCompanyId(cid))
  }, [])

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (!data || typeof data !== 'object') return
        const d = data as {
          isTrialActive?: boolean
          trialDaysLeft?: number | null
          user?: { effectivePlan?: string }
        }
        setTrial({
          isTrialActive: d.isTrialActive ?? false,
          trialDaysLeft: d.trialDaysLeft ?? null,
          effectivePlan: d.user?.effectivePlan ?? 'free',
        })
      })
      .catch(() => { /* ok */ })
  }, [])

  // Close drawer on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleDrawerSelect(id: DrawerType) {
    setActiveDrawer(prev => prev === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        trial={trial}
        activeDrawer={activeDrawer}
        onDrawerSelect={handleDrawerSelect}
      />

      <QuickDrawerOverlay
        type={activeDrawer}
        companyId={companyId}
        onClose={() => setActiveDrawer(null)}
      />

      <div className="lg:pl-60">
        <TrialBanner trial={trial} />
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600 text-white font-bold text-[10px]">N</div>
            <span className="text-sm font-semibold text-white">NEXUS</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
