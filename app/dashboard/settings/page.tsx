'use client'

import { useState } from 'react'
import {
  Palette, User, Bell, Shield,
  Lightbulb, Brain, Zap, Star, Sparkles, Clock, Wrench,
} from 'lucide-react'
import ThemeSelector from '@/components/ui/theme-selector'
import LiveDashboardPreview from '@/components/ui/live-dashboard-preview'
import ColorCustomizer from '@/components/ui/color-customizer'
import { cn } from '@/lib/cn'
import { getRecommendedTheme, THEMES } from '@/lib/themes/themes'
import { useTheme } from '@/lib/themes/theme-context'

// ─── Tab definitions ──────────────────────────────────────────────

const TABS = [
  { id: 'aparencia', label: 'Aparência', icon: Palette  },
  { id: 'perfil',    label: 'Perfil',    icon: User     },
  { id: 'alertas',   label: 'Alertas',   icon: Bell     },
  { id: 'seguranca', label: 'Segurança', icon: Shield   },
] as const

type TabId = typeof TABS[number]['id']

// ─── Placeholder tabs ─────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <Wrench size={20} className="text-zinc-500" />
      </div>
      <p className="font-medium text-white">{label}</p>
      <p className="text-sm text-zinc-500">Esta seção estará disponível em breve.</p>
    </div>
  )
}

// ─── Why smart themes block ───────────────────────────────────────

const WHY_POINTS = [
  {
    icon:  Sparkles,
    title: 'Experiência personalizada',
    body:  'Adapte o visual do NEXUS ao seu estilo de trabalho e aumente seu conforto diário.',
  },
  {
    icon:  Zap,
    title: 'Mais produtividade',
    body:  'Temas otimizados para leitura reduzem a fadiga visual e mantêm o foco nas métricas.',
  },
  {
    icon:  Brain,
    title: 'IA adaptativa',
    body:  'O NEXUS aprende seus hábitos e poderá recomendar temas automaticamente no futuro.',
  },
  {
    icon:  Star,
    title: 'Customização total',
    body:  'Ajuste cores primárias, secundárias e de destaque para criar uma identidade única.',
  },
]

function WhySmartThemes() {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6">
      <div className="mb-5 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Por que temas inteligentes?</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/60">
              <Icon size={15} className="text-violet-400" />
            </div>
            <p className="text-xs font-semibold text-white">{title}</p>
            <p className="text-[11px] leading-relaxed text-zinc-500">{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI Recommendation block ──────────────────────────────────────

function AIRecommendation() {
  const { themeKey, setTheme } = useTheme()
  const recommendedKey = getRecommendedTheme()
  const rec = THEMES[recommendedKey]
  const hour = new Date().getHours()
  const isAlreadyActive = themeKey === recommendedKey

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl border p-5"
      style={{
        background:  `${rec.colors.primary}0a`,
        borderColor: `${rec.colors.primary}30`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm"
          style={{ background: `${rec.colors.primary}20`, border: `1px solid ${rec.colors.primary}30` }}
        >
          <Sparkles size={14} style={{ color: rec.colors.primary }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">Recomendado para você</p>
            <span className="flex items-center gap-1 rounded-full bg-violet-600/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              <Clock size={9} />
              {hour}h — agora
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {rec.label} — {rec.recommendedReason ?? rec.description}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Baseado no horário atual. Personalização por contexto chegará em breve.
          </p>
        </div>
      </div>

      {isAlreadyActive ? (
        <div className="shrink-0 flex items-center gap-1.5 rounded-xl border border-green-600/30 bg-green-600/15 px-4 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-xs font-semibold text-green-400">Ativo</span>
        </div>
      ) : (
        <button
          onClick={() => setTheme(recommendedKey)}
          className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
          style={{ background: rec.colors.primary }}
        >
          Aplicar
        </button>
      )}
    </div>
  )
}

// ─── Aparência tab (full layout) ──────────────────────────────────

function AparenciaTab() {
  return (
    <div className="space-y-8">
      {/* Tip banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-violet-600/20 bg-violet-600/8 px-4 py-3">
        <Lightbulb size={15} className="shrink-0 text-amber-400" />
        <p className="text-xs text-zinc-300">
          <span className="font-semibold text-violet-300">Dica:</span>{' '}
          Passe o mouse sobre um tema para pré-visualizar a aparência completa do NEXUS antes de aplicar.
        </p>
      </div>

      {/* Two-column: selector + live preview */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: theme cards */}
        <div className="lg:col-span-7">
          <ThemeSelector />
        </div>

        {/* Right: live preview (sticky) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24">
            <LiveDashboardPreview />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/50" />

      {/* Advanced color customizer */}
      <ColorCustomizer />

      {/* Divider */}
      <div className="border-t border-zinc-800/50" />

      {/* AI recommendation */}
      <AIRecommendation />

      {/* Why smart themes */}
      <WhySmartThemes />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('aparencia')

  return (
    <div className="px-6 py-8 md:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Personalize o NEXUS de acordo com as suas preferências.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-8 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {TABS.map((tab) => {
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
      {activeTab === 'aparencia' ? (
        <AparenciaTab />
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            {activeTab === 'perfil'    && <ComingSoon label="Perfil e dados da empresa" />}
            {activeTab === 'alertas'   && <ComingSoon label="Configurações de alertas" />}
            {activeTab === 'seguranca' && <ComingSoon label="Segurança e acesso" />}
          </div>
        </div>
      )}
    </div>
  )
}
