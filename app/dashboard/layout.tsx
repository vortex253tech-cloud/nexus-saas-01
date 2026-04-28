'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Database, Zap, Bell, History,
  CreditCard, Menu, X, Building2, ChevronRight,
  DollarSign, MessageSquare, LogOut, Users, Clock,
  ArrowRight, Mail, FolderOpen, Map, Settings,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth-provider'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/financeiro', label: 'Financeiro',    icon: DollarSign },
  { href: '/dashboard/clients',    label: 'Clientes',      icon: Users },
  { href: '/dashboard/messages',   label: 'Mensagens',     icon: Mail },
  { href: '/dashboard/projects',    label: 'Projetos',           icon: FolderOpen },
  { href: '/dashboard/growth-map', label: 'Mapa de Crescimento', icon: Map },
  { href: '/dashboard/assistant',  label: 'Assistente IA',       icon: MessageSquare },
  { href: '/dashboard/dados',      label: 'Dados',         icon: Database },
  { href: '/dashboard/actions',    label: 'Ações',         icon: Zap },
  { href: '/dashboard/alerts',     label: 'Alertas',       icon: Bell },
  { href: '/dashboard/history',    label: 'Histórico',     icon: History },
  { href: '/dashboard/billing',    label: 'Plano',         icon: CreditCard },
  { href: '/dashboard/settings',  label: 'Configurações', icon: Settings },
]

// ─── Trial Banner ──────────────────────────────────────────────

interface TrialInfo {
  isTrialActive: boolean
  trialDaysLeft: number | null
  effectivePlan: string
}

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
            ? `⚠ Trial expira em ${trial.trialDaysLeft} dia${trial.trialDaysLeft !== 1 ? 's' : ''}!`
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
}: {
  open: boolean
  onClose: () => void
  trial: TrialInfo
}) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa')
  const [userEmail,   setUserEmail]   = useState('')

  // email comes from Supabase Auth session (instant, no API call needed)
  useEffect(() => {
    if (user?.email) setUserEmail(user.email)
  }, [user])

  // company name comes from our custom table — still needs API
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
        {/* Logo + company */}
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

        {/* Trial indicator in sidebar */}
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trial, setTrial] = useState<TrialInfo>({
    isTrialActive: false,
    trialDaysLeft: null,
    effectivePlan: 'free',
  })

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
      .catch(() => { /* ok — no trial info */ })
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} trial={trial} />
      <div className="lg:pl-60">
        {/* Trial banner — top of all pages */}
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
