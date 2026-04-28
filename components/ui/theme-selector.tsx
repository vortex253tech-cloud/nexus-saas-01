'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, Sparkles } from 'lucide-react'
import { useTheme } from '@/lib/themes/theme-context'
import {
  THEMES, THEME_KEYS, getRecommendedTheme,
  type ThemeKey, type NexusTheme,
} from '@/lib/themes/themes'

// ─── Mini Dashboard inside each card ─────────────────────────────

function MiniDashboard({ t }: { t: NexusTheme }) {
  const c = t.colors
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.border}`, height: '80px' }}
    >
      {/* Sidebar strip */}
      <div
        className="absolute inset-y-0 left-0 flex flex-col gap-1 px-1.5 py-2"
        style={{ width: '26px', background: c.sidebar, borderRight: `1px solid ${c.border}` }}
      >
        <div className="h-1.5 rounded-sm" style={{ background: c.primary }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-1 rounded-sm" style={{ background: c.textMuted, opacity: 0.4 }} />
        ))}
      </div>

      {/* Content area */}
      <div className="absolute inset-0 ml-[26px] flex flex-col gap-1 p-1.5">
        {/* 3 KPI cells */}
        <div className="flex gap-1">
          {[
            { label: 'MRR', val: '48k',  col: c.primary },
            { label: 'NPS', val: '74',   col: c.text    },
            { label: '+%',  val: '+23',  col: c.secondary },
          ].map(({ label, val, col }) => (
            <div
              key={label}
              className="flex flex-1 flex-col rounded px-1 py-0.5"
              style={{ background: c.card, border: `1px solid ${c.border}` }}
            >
              <span className="text-[6px]" style={{ color: c.textMuted }}>{label}</span>
              <span className="text-[8px] font-bold leading-none" style={{ color: col }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div
          className="flex flex-1 items-end gap-0.5 rounded px-1.5 pb-0.5"
          style={{ background: c.card, border: `1px solid ${c.border}` }}
        >
          {[30, 55, 40, 70, 50, 85, 60, 90].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height:     `${h}%`,
                background: i === 7 ? c.primary : c.chartBar,
              }}
            />
          ))}
        </div>

        {/* AI strip */}
        <div
          className="flex items-center gap-0.5 rounded px-1 py-0.5"
          style={{ background: `${c.primary}18`, border: `1px solid ${c.primary}25` }}
        >
          <span className="text-[6px]" style={{ color: c.primary }}>✦ Insight IA · crescimento 23%</span>
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
          key="banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{   y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-zinc-900/90 px-5 py-2.5 shadow-2xl backdrop-blur-lg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            <span className="text-sm font-medium text-white">
              Pré-visualizando:{' '}
              <span className="font-bold text-violet-400">{THEMES[previewKey].label}</span>
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
  const t  = THEMES[themeKey]
  const c  = t.colors

  return (
    <motion.div
      className="relative"
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      onHoverStart={() => onHoverStart(themeKey)}
      onHoverEnd={onHoverEnd}
    >
      <button
        onClick={() => onSelect(themeKey)}
        className="group relative w-full overflow-hidden rounded-2xl border p-3.5 text-left"
        style={{
          background:  c.card,
          borderColor: active ? c.primary : c.border,
          color:       c.text,
          transition:  'box-shadow 0.25s ease, border-color 0.25s ease',
          boxShadow:   active
            ? `0 0 0 1px ${c.primary}80, 0 0 28px ${c.primary}35`
            : 'none',
        }}
      >
        {/* Top row: badges + check */}
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {active && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: `${c.primary}25`, color: c.primary, border: `1px solid ${c.primary}40` }}
              >
                ATIVO
              </span>
            )}
            {t.tag && !active && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: `${c.primary}18`, color: c.primary, border: `1px solid ${c.primary}25` }}
              >
                {t.tag}
              </span>
            )}
            {recommended && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: `${c.secondary}18`, color: c.secondary, border: `1px solid ${c.secondary}25` }}
              >
                <Clock size={8} />
                Agora
              </span>
            )}
          </div>

          {/* Animated check */}
          <AnimatePresence>
            {active && (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{   scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: c.primary }}
              >
                <Check className="h-3 w-3" style={{ color: c.primaryFg }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mini dashboard */}
        <MiniDashboard t={t} />

        {/* Name + description */}
        <div className="mt-3">
          <p className="text-sm font-bold" style={{ color: c.text }}>{t.label}</p>
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: c.textMuted }}>
            {t.description}
          </p>
        </div>

        {/* Effect badges */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {t.effects.glow && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${c.primary}18`, color: c.primary }}
            >
              Glow
            </span>
          )}
          {t.effects.blur && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${c.secondary}18`, color: c.secondary }}
            >
              Glass
            </span>
          )}
          {t.effects.neon && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
              style={{ background: `${c.accent}18`, color: c.accent }}
            >
              Neon
            </span>
          )}
        </div>

        {/* Active glow pulse */}
        {active && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            style={{ boxShadow: `inset 0 0 28px ${c.primary}18` }}
          />
        )}
      </button>
    </motion.div>
  )
}

// ─── Apply button ─────────────────────────────────────────────────

function ApplyButton({ themeKey }: { themeKey: ThemeKey }) {
  const [confirming, setConfirming] = useState(false)

  function handleClick() {
    setConfirming(true)
    setTimeout(() => setConfirming(false), 2000)
  }

  const t = THEMES[themeKey]

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      style={{
        background:   confirming ? 'rgb(22,163,74)' : t.colors.primary,
        boxShadow:    confirming ? '0 0 20px rgba(22,163,74,0.4)' : `0 0 20px ${t.colors.primary}40`,
        transition:   'background 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.span
            key="ok"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -4 }}
            className="flex items-center gap-1.5"
          >
            <Check size={14} />
            Tema aplicado!
          </motion.span>
        ) : (
          <motion.span
            key="apply"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -4 }}
          >
            Aplicar tema — {t.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Main export ──────────────────────────────────────────────────

export default function ThemeSelector() {
  const { themeKey, previewKey, setTheme, previewTheme, clearPreview } = useTheme()
  const [recommendedKey] = useState<ThemeKey>(() => getRecommendedTheme())

  return (
    <>
      <div className="space-y-5">
        {/* Section title */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Escolha seu tema</h3>
            <p className="text-xs text-zinc-500">
              Passe o mouse para pré-visualizar em tempo real • Clique para aplicar permanentemente.
            </p>
          </div>
        </div>

        {/* Cards grid */}
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

        {/* Apply button */}
        <div className="flex items-center gap-4">
          <ApplyButton themeKey={themeKey} />
          <p className="text-xs text-zinc-600">
            Tema ativo:{' '}
            <span className="font-medium text-zinc-400">{THEMES[themeKey].label}</span>
            {' '}— salvo automaticamente
          </p>
        </div>
      </div>

      {/* Hover preview notification */}
      <PreviewBanner previewKey={previewKey} />
    </>
  )
}
