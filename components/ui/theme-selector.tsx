'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useTheme } from '@/lib/themes/theme-context'
import { THEMES, THEME_KEYS, type ThemeKey } from '@/lib/themes/themes'
import { cn } from '@/lib/cn'

// ─── Colour swatch row ────────────────────────────────────────────

function Swatch({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'rounded-full border border-black/10',
        size === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
      )}
      style={{ background: color }}
    />
  )
}

// ─── Preview card (shown on hover) ───────────────────────────────

function ThemePreview({ themeKey }: { themeKey: ThemeKey }) {
  const t = THEMES[themeKey]
  return (
    <div
      className="pointer-events-none absolute inset-x-0 -top-2 z-10 -translate-y-full rounded-xl border p-3 shadow-2xl"
      style={{
        background:   t.colors.card,
        borderColor:  t.colors.borderStrong,
        color:        t.colors.text,
      }}
    >
      {/* Mini navbar */}
      <div
        className="mb-2 flex items-center justify-between rounded-lg px-2.5 py-1.5"
        style={{ background: t.colors.sidebar, borderBottom: `1px solid ${t.colors.border}` }}
      >
        <span className="text-[10px] font-bold" style={{ color: t.colors.primary }}>NEXUS</span>
        <div className="flex gap-1">
          {[t.colors.primary, t.colors.secondary, t.colors.accent].map((c, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
      {/* Mini stat cards */}
      <div className="grid grid-cols-3 gap-1">
        {['Receita', 'Clientes', 'Lucro'].map((label, i) => (
          <div
            key={label}
            className="rounded-md px-1.5 py-1"
            style={{
              background:   t.colors.cardHover,
              border:       `1px solid ${t.colors.border}`,
            }}
          >
            <p className="text-[8px]" style={{ color: t.colors.textMuted }}>{label}</p>
            <p
              className="text-[10px] font-bold"
              style={{ color: i === 0 ? t.colors.primary : t.colors.text }}
            >
              {['R$ 12k', '234', '+18%'][i]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Single theme card ────────────────────────────────────────────

function ThemeCard({
  themeKey,
  active,
  onSelect,
}: {
  themeKey: ThemeKey
  active:   boolean
  onSelect: (k: ThemeKey) => void
}) {
  const t = THEMES[themeKey]
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Preview tooltip */}
      {hovered && <ThemePreview themeKey={themeKey} />}

      <button
        onClick={() => onSelect(themeKey)}
        className={cn(
          'group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200',
          active
            ? 'ring-2 ring-offset-2 ring-offset-transparent scale-[1.02]'
            : 'hover:scale-[1.02]',
        )}
        style={{
          background:   t.colors.card,
          borderColor:  active ? t.colors.primary : t.colors.border,
          color:        t.colors.text,
          '--tw-ring-color': t.colors.primary,
          boxShadow: active
            ? `0 0 20px ${t.colors.primary}40`
            : hovered ? `0 4px 24px ${t.colors.primary}20` : 'none',
        } as React.CSSProperties}
      >
        {/* Mini gradient strip */}
        <div
          className="mb-3 h-10 w-full rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${t.colors.primary}33, ${t.colors.secondary}22, ${t.colors.accent}11)`,
            border: `1px solid ${t.colors.border}`,
          }}
        >
          <div className="flex h-full items-center justify-between px-2.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: t.colors.primary }}>
              NEXUS
            </span>
            <div className="flex gap-1">
              <Swatch color={t.colors.primary}   size="sm" />
              <Swatch color={t.colors.secondary} size="sm" />
              <Swatch color={t.colors.accent}    size="sm" />
            </div>
          </div>
        </div>

        {/* Label + description */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: t.colors.text }}>
              {t.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: t.colors.textMuted }}>
              {t.description}
            </p>
          </div>
          {active && (
            <div
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: t.colors.primary }}
            >
              <Check className="h-3 w-3" style={{ color: t.colors.primaryFg }} />
            </div>
          )}
        </div>

        {/* Effect badges */}
        <div className="mt-3 flex flex-wrap gap-1">
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
      </button>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────

export default function ThemeSelector() {
  const { themeKey, setTheme } = useTheme()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">Aparência</h3>
          <p className="text-xs text-zinc-500">
            Escolha o visual do NEXUS. Passe o mouse para pré-visualizar.
          </p>
        </div>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {THEME_KEYS.map(key => (
          <ThemeCard
            key={key}
            themeKey={key}
            active={themeKey === key}
            onSelect={setTheme}
          />
        ))}
      </div>

      {/* Active indicator */}
      <p className="text-xs text-zinc-600">
        Tema ativo:{' '}
        <span className="font-medium text-zinc-400">{THEMES[themeKey].label}</span>
        {' '}— salvo automaticamente.
      </p>
    </div>
  )
}
