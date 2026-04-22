'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Database, Zap, Bell, History,
  CreditCard, Menu, X, Building2, ChevronRight,
  DollarSign, MessageSquare, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getSupabaseClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/financeiro', label: 'Financeiro',    icon: DollarSign },
  { href: '/dashboard/assistant',  label: 'Assistente IA', icon: MessageSquare },
  { href: '/dashboard/dados',      label: 'Dados',         icon: Database },
  { href: '/dashboard/actions',    label: 'Ações',         icon: Zap },
  { href: '/dashboard/alerts',     label: 'Alertas',       icon: Bell },
  { href: '/dashboard/history',    label: 'Histórico',     icon: History },
  { href: '/dashboard/billing',    label: 'Plano',         icon: CreditCard },
]

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa')
  const [userEmail,   setUserEmail]   = useState('')

  useEffect(() => {
    // Load company name from auth session
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'company' in data) {
          const d = data as { company?: { name?: string }; user?: { email?: string } }
          if (d.company?.name) setNomeEmpresa(d.company.name)
          if (d.user?.email)   setUserEmail(d.user.email)
        }
      })
      .catch(() => {
        // Fallback to sessionStorage
        try {
          const raw = sessionStorage.getItem('nexus_resultado')
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (typeof parsed.nomeEmpresa === 'string') setNomeEmpresa(parsed.nomeEmpresa)
            if (typeof parsed.email === 'string')       setUserEmail(parsed.email)
          }
        } catch { /* ok */ }
      })
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch { /* ok */ }
    sessionStorage.clear()
    router.push('/login')
  }

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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
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

        {/* Footer with logout */}
        <div className="px-4 py-4 border-t border-zinc-800/60 space-y-2">
          {userEmail && (
            <p className="text-[10px] text-zinc-600 px-2 truncate">{userEmail}</p>
          )}
          <button
            onClick={handleLogout}
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-60">
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
