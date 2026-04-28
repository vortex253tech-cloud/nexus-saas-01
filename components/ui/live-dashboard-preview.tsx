'use client'

import { motion } from 'framer-motion'
import {
  LayoutDashboard, DollarSign, Users, MessageSquare,
  Zap, Bell, ChevronRight, TrendingUp, ArrowUpRight,
} from 'lucide-react'
import { useTheme } from '@/lib/themes/theme-context'
import { THEMES } from '@/lib/themes/themes'

// ─── Helpers ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',   active: true  },
  { icon: DollarSign,      label: 'Financeiro',   active: false },
  { icon: Users,           label: 'Clientes',     active: false },
  { icon: MessageSquare,   label: 'Assistente IA',active: false },
  { icon: Zap,             label: 'Ações',        active: false },
  { icon: Bell,            label: 'Alertas',      active: false },
]

const KPI_CARDS = [
  { label: 'MRR',             value: 'R$ 48.200', change: '+12%' },
  { label: 'Clientes Ativos', value: '1.243',     change: '+7%'  },
  { label: 'NPS',             value: '74',        change: '+3pts'},
  { label: 'Churn Rate',      value: '1.2%',      change: '-0.4%'},
]

const BAR_HEIGHTS = [35, 55, 40, 70, 60, 85, 75, 90, 65, 80, 95, 78]

// ─── Component ────────────────────────────────────────────────────

export default function LiveDashboardPreview() {
  const { themeKey, previewKey } = useTheme()
  const activeKey = previewKey ?? themeKey
  const c = THEMES[activeKey].colors

  return (
    <div className="space-y-3">
      {/* Header label */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Preview em tempo real</p>
          <p className="text-xs text-zinc-500">Simulação do dashboard com o tema selecionado</p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: `${c.primary}20`, color: c.primary, border: `1px solid ${c.primary}30` }}
        >
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: c.primary }} />
          {THEMES[activeKey].label}
        </div>
      </div>

      {/* Dashboard frame */}
      <motion.div
        key={activeKey}
        initial={{ opacity: 0.7, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden rounded-2xl"
        style={{ border: `1.5px solid ${c.borderStrong}`, background: c.bg }}
      >
        {/* Top header bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: c.sidebar, borderBottom: `1px solid ${c.border}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold"
              style={{ background: c.primary, color: c.primaryFg }}
            >
              N
            </div>
            <span className="text-xs font-bold" style={{ color: c.text }}>NEXUS</span>
            <span className="text-[10px]" style={{ color: c.textMuted }}>Minha Empresa</span>
          </div>
          <div className="flex gap-1.5">
            {[c.primary, c.secondary, c.accent].map((col, i) => (
              <div key={i} className="h-2 w-2 rounded-full" style={{ background: col }} />
            ))}
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex" style={{ minHeight: '360px' }}>
          {/* Sidebar */}
          <div
            className="flex flex-col gap-0.5 px-2 py-3"
            style={{
              width:       '130px',
              background:  c.sidebar,
              borderRight: `1px solid ${c.border}`,
              flexShrink:  0,
            }}
          >
            {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors"
                style={{
                  background:  active ? `${c.primary}20` : 'transparent',
                  border:      `1px solid ${active ? `${c.primary}30` : 'transparent'}`,
                }}
              >
                <Icon size={10} style={{ color: active ? c.primary : c.textMuted }} />
                <span
                  className="text-[9px] font-medium leading-none"
                  style={{ color: active ? c.primary : c.textMuted }}
                >
                  {label}
                </span>
                {active && <ChevronRight size={8} style={{ color: c.primary, marginLeft: 'auto' }} />}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-3">
            {/* Page title */}
            <div>
              <p className="text-[11px] font-bold" style={{ color: c.text }}>Dashboard</p>
              <p className="text-[9px]" style={{ color: c.textMuted }}>Bem-vindo de volta 👋</p>
            </div>

            {/* KPI cards 2×2 */}
            <div className="grid grid-cols-2 gap-1.5">
              {KPI_CARDS.map(({ label, value, change }, i) => (
                <div
                  key={label}
                  className="rounded-xl p-2"
                  style={{ background: c.card, border: `1px solid ${c.border}` }}
                >
                  <p className="text-[8px]" style={{ color: c.textMuted }}>{label}</p>
                  <p className="mt-0.5 text-[12px] font-bold leading-none" style={{ color: c.text }}>
                    {value}
                  </p>
                  <div className="mt-1 flex items-center gap-0.5">
                    <ArrowUpRight size={7} style={{ color: i === 3 ? c.accent : c.secondary }} />
                    <span className="text-[8px] font-semibold" style={{ color: i === 3 ? c.accent : c.secondary }}>
                      {change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div
              className="flex-1 rounded-xl p-2.5"
              style={{ background: c.card, border: `1px solid ${c.border}` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold" style={{ color: c.text }}>Receita por período</span>
                <TrendingUp size={9} style={{ color: c.primary }} />
              </div>
              <div className="flex items-end gap-0.5" style={{ height: '52px' }}>
                {BAR_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all duration-300"
                    style={{
                      height:     `${h}%`,
                      background: i === BAR_HEIGHTS.length - 1 ? c.primary : c.chartBar,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* AI insight */}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: `${c.primary}18`, border: `1px solid ${c.primary}28` }}
            >
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px]"
                style={{ background: `${c.primary}30`, color: c.primary }}
              >
                ✦
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold" style={{ color: c.primary }}>Insight IA</p>
                <p className="text-[9px] leading-tight" style={{ color: c.textMuted }}>
                  Crescimento de 23% em relação ao mês anterior. Clientes recorrentes em alta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
