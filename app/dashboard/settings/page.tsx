'use client'

import { useState } from 'react'
import { Palette, User, Bell, Shield } from 'lucide-react'
import ThemeSelector from '@/components/ui/theme-selector'
import { cn } from '@/lib/cn'

// ─── Tab definitions ──────────────────────────────────────────────

const TABS = [
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'perfil',    label: 'Perfil',    icon: User },
  { id: 'alertas',   label: 'Alertas',   icon: Bell },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
] as const

type TabId = typeof TABS[number]['id']

// ─── Placeholder for unbuilt tabs ─────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <span className="text-xl">🚧</span>
      </div>
      <p className="font-medium text-white">{label}</p>
      <p className="text-sm text-zinc-500">Esta seção estará disponível em breve.</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('aparencia')

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Personalize o NEXUS de acordo com as suas preferências.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-8 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {TABS.map(tab => {
          const Icon   = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 border border-transparent',
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        {activeTab === 'aparencia' && <ThemeSelector />}
        {activeTab === 'perfil'    && <ComingSoon label="Perfil e dados da empresa" />}
        {activeTab === 'alertas'   && <ComingSoon label="Configurações de alertas" />}
        {activeTab === 'seguranca' && <ComingSoon label="Segurança e acesso" />}
      </div>
    </div>
  )
}
