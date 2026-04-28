'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, Clock, Lock } from 'lucide-react'
import { useTheme } from '@/lib/themes/theme-context'
import {
  THEMES, THEME_KEYS, getRecommendedTheme,
  type ThemeKey, type NexusTheme,
} from '@/lib/themes/themes'
import { cn } from '@/lib/cn'

// ─── Mini Dashboard (scaled preview inside card) ──────────────────

function MiniDashboard({ t }: { t: NexusTheme }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        background:  t.colors.bg,
        border:      `1px solid ${t.colors.border}`,
        height:      '88px',
      }}
    >
      {/* Sidebar strip */}
      <div
        className="absolute inset-y-0 left-0 flex flex-col gap-1 px-1.5 py-2"
        style={{ width: '28px', background: t.colors.sidebar, borderRight: `1px solid ${t.colors.border}` }}
      >
        <div className="h-2 rounded-sm" style={{ background: t.colors.primary, opacity: 0.9 }} />
        {[0.4, 0.4, 0.4].map((op, i) => (
          <div key={i} className="h-1.5 rounded-sm" style={{ background: t.colors.textMuted, opacity: op }} />
        ))}
      </div>

      {/* Main area */}
      <div className="absolute inset-0 ml-[28px] flex flex-col gap-1.5 p-2">
        {/* KPI row */}
        <div className="flex gap-1.5">
          {[
            { label: 'MRR',    value: '12k', color: t.colors.primary   },
            { label: 'Clientes', value: '234', color: t.colors.text     },
            { label: 'NPS',    value: '+18',  color: t.colors.secondary },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-1 flex-col rounded-md px-1.5 py-1"
              style={{ background: t.colors.card, border: `1px solid ${t.colors.border}` }}
            >
              <span className="text-[7px]" style={{ color: t.colors.textMuted }}>{label}</span>
              <span className="text-[9px] font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div
          className="flex flex-1 items-end gap-0.5 rounded-md px-2 pb-1"
          style={{ background: t.colors.card, border: `1px solid ${t.colors.border}` }}
        >
          {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height:     `${h}%`,
                background: i === 5 ? t.colors.primary : t.colors.chartBar,
                opacity:    i === 5 ? 1 : 0.8,
              }}
            />
          ))}
        </div>

        {/* AI insight strip */}
        <div
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
          style={{ background: `${t.colors.primary}18`, border: `1px solid ${t.colors.primary}30` }}
        >
          <div className="h-1 w-1 rounded-full" style={{ background: t.colors.primary }} />
          <span className="text-[7px]" style={{ color: t.colors.primary }}>Insight IA · Crescimento 23%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Preview Banner (fixed bottom) ────────────────────────────────

function PreviewBanner({ previewKey }: { previewKey: ThemeKey | null }) {
  return (
    <AnimatePresence>
      {previewKey && (
        <motion.div
          key="preview-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{   y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-zinc-900/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            <span className="text-sm font-medium text-white">
              Pré-visualizando: <span className="text-violet-400">{THEMES[previewKey].label}</span>
            </span>
            <span className="text-xs text-zinc-500">Clique para aplicar</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Single theme card ─────────────────────────────────────────────

function ThemeCard({
  themeKey,
  active,
  onSelect,
  onHoverStart,
  onHoverEnd,
  recommended,
}: {
  themeKey:     ThemeKey
  active:       boolean
  onSelect:     (k: ThemeKey) => void
  onHoverStart: (k: ThemeKey) => void
  onHoverEnd:   () => void
  recommended:  boolean
}) {
  const t = THEMES[themeKey]

  return (
    <motion.div
      className="relative"
      initial={false}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onHoverStart={() => onHoverStart(themeKey)}
      onHoverEnd={onHoverEnd}
    >
      <button
        onClick={() => onSelect(themeKey)}
        className="group relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-shadow duration-200"
        style={{
          background:  t.colors.card,
          borderColor: active ? t.colors.primary : t.colors.border,
          color:       t.colors.text,
          boxShadow:   active
            ? `0 0 24px ${t.colors.primary}40, 0 0 0 1px ${t.colors.primary}60`
            : 'none',
        }}
      >
        {/* Badges row */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {t.tag && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{
                  background: `${t.colors.primary}20`,
                  color:       t.colors.primary,
                  border:     `1px solid ${t.colors.primary}30`,
                }}
              >
                {t.tag}
              </span>
            )}
            {recommended && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{
                  background: `${t.colors.secondary}20`,
                  color:       t.colors.secondary,
                  border:     `1px solid ${t.colors.secondary}30`,
                }}
              >
                <Clock size={8} />
                Recomendado agora
              </span>
            )}
          </div>

          {/* Active checkmark */}
          <AnimatePresence>
            {active && (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{   scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: t.colors.primary }}
              >
                <Check className="h-3 w-3" style={{ color: t.colors.primaryFg }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mini dashboard preview */}
        <MiniDashboard t={t} />

        {/* Label + description */}
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: t.colors.text }}>
              {t.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: t.colors.textMuted }}>
              {t.description}
            </p>
          </div>
        </div>

        {/* Effect badges */}
        <div className="mt-2 flex flex-wrap gap-1">
          {t.effects.glow && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${t.colors.primary}20`, color: t.colors.primary }}
            >
              Glow
            </span>
          )}
          {t.effects.blur && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${t.colors.secondary}20`, color: t.colors.secondary }}
            >
              Glass
            </span>
          )}
          {t.effects.neon && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${t.colors.accent}20`, color: t.colors.accent }}
            >
              Neon
            </span>
          )}
        </div>

        {/* Active glow border animation */}
        {active && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            style={{ boxShadow: `inset 0 0 24px ${t.colors.primary}20` }}
          />
        )}
      </button>
    </motion.div>
  )
}

// ─── Color Customizer (PRO-gated) ─────────────────────────────────

function ColorCustomizer() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {/* PRO lock overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
          <Lock size={16} className="text-zinc-400" />
        </div>
        <p className="text-sm font-semibold text-white">Personalização White-Label</p>
        <p className="text-center text-xs text-zinc-500">Disponível no plano PRO</p>
        <button className="mt-1 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors">
          Fazer upgrade
        </button>
      </div>

      {/* Background preview (blurred under lock) */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cores personalizadas</p>
      <div className="grid grid-cols-5 gap-2">
        {['Primária', 'Secundária', 'Destaque', 'Fundo', 'Card'].map((label) => (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="h-8 w-full rounded-lg bg-violet-600/40" />
            <p className="text-center text-[9px] text-zinc-600">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────

export default function ThemeSelector() {
  const { themeKey, previewKey, setTheme, previewTheme, clearPreview } = useTheme()
  const [recommendedKey] = useState<ThemeKey>(() => getRecommendedTheme())

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Aparência</h3>
            <p className="text-xs text-zinc-500">
              Passe o mouse para pré-visualizar • Clique para aplicar e salvar.
            </p>
          </div>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {THEME_KEYS.map((key) => (
            <ThemeCard
              key={key}
              themeKey={key}
              active={themeKey === key && previewKey === null}
              onSelect={setTheme}
              onHoverStart={previewTheme}
              onHoverEnd={clearPreview}
              recommended={recommendedKey === key}
            />
          ))}
        </div>

        {/* Active label */}
        <p className="text-xs text-zinc-600">
          Tema ativo:{' '}
          <span className="font-medium text-zinc-400">{THEMES[themeKey].label}</span>
          {' '}— salvo automaticamente.
        </p>

        {/* Divider */}
        <div className="border-t border-zinc-800/60" />

        {/* White-label customizer */}
        <ColorCustomizer />
      </div>

      {/* Preview Banner (outside scroll, fixed to viewport) */}
      <PreviewBanner previewKey={previewKey} />
    </>
  )
}
