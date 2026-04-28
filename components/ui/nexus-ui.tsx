'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/cn'

// ─── GlowCard ────────────────────────────────────────────────────
// Hover: elevate + subtle primary glow. Wraps any content.

export function GlowCard({
  children,
  className,
  glowColor,
}: {
  children: ReactNode
  className?: string
  glowColor?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cn('nexus-card', className)}
      style={glowColor ? { '--card-glow': glowColor } as React.CSSProperties : undefined}
    >
      {children}
    </motion.div>
  )
}

// ─── PremiumButton ───────────────────────────────────────────────
// Gradient animated button with loading + success states.

interface PremiumButtonProps {
  children: ReactNode
  onClick?: () => void
  loading?: boolean
  success?: boolean
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'danger' | 'ghost'
}

export function PremiumButton({
  children,
  onClick,
  loading = false,
  success = false,
  disabled = false,
  className,
  size = 'md',
  variant = 'primary',
}: PremiumButtonProps) {
  const sizes = {
    sm:  'px-3 py-1.5 text-xs',
    md:  'px-4 py-2 text-sm',
    lg:  'px-6 py-3 text-sm',
  }
  const variants = {
    primary: 'bg-violet-600 hover:bg-violet-500 text-white',
    danger:  'bg-red-600/80 hover:bg-red-600 text-white',
    ghost:   'bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-white border border-zinc-700',
  }

  return (
    <motion.button
      whileHover={disabled || loading ? {} : { scale: 1.02 }}
      whileTap={disabled || loading ? {} : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl font-semibold transition-all',
        'relative overflow-hidden',
        sizes[size],
        success ? 'bg-emerald-600 text-white' : variants[variant],
        (disabled || loading) && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {/* Shimmer on hover */}
      {!disabled && !loading && variant === 'primary' && (
        <motion.div
          className="absolute inset-0 -skew-x-12 bg-white/10"
          initial={{ x: '-100%' }}
          whileHover={{ x: '200%' }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="spinner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
          />
        ) : (
          <motion.span key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── AIStatusBar ─────────────────────────────────────────────────
// Horizontal bar showing the current AI state.

type AIStatus = 'monitoring' | 'analyzing' | 'thinking' | 'executing' | 'completed'

const STATUS_CONFIG: Record<AIStatus, { label: string; color: string; pulse: boolean }> = {
  monitoring: { label: 'IA Monitorando',  color: 'text-emerald-400', pulse: true  },
  analyzing:  { label: 'IA Analisando',   color: 'text-violet-400',  pulse: true  },
  thinking:   { label: 'IA Pensando',     color: 'text-amber-400',   pulse: true  },
  executing:  { label: 'IA Executando',   color: 'text-blue-400',    pulse: true  },
  completed:  { label: 'Concluído',       color: 'text-emerald-400', pulse: false },
}

export function AIStatusBar({
  status = 'monitoring',
  className,
}: {
  status?: AIStatus
  className?: string
}) {
  const cfg = STATUS_CONFIG[status]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'completed' ? 'bg-emerald-400' : 'bg-current',
          cfg.color,
          'ai-pulse',
        )}
      />
      <span className={cn('text-xs font-semibold tracking-wide', cfg.color)}>
        {cfg.label}
      </span>
    </div>
  )
}

// ─── AnimatedBadge ───────────────────────────────────────────────
// Priority/status badge with optional pulse animation.

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'ai' | 'success' | 'warning'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40',
  high:     'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  medium:   'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  low:      'bg-zinc-700/60 text-zinc-400 border border-zinc-600/40',
  ai:       'bg-violet-600/20 text-violet-400 border border-violet-600/40',
  success:  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
  warning:  'bg-orange-500/20 text-orange-400 border border-orange-500/40',
}

export function AnimatedBadge({
  children,
  variant = 'medium',
  pulse = false,
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        BADGE_STYLES[variant],
        className,
      )}
    >
      {pulse && (
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          variant === 'critical' ? 'bg-red-400 ai-pulse' :
          variant === 'high'     ? 'bg-orange-400 ai-pulse' :
          variant === 'ai'       ? 'bg-violet-400 ai-pulse' :
                                   'bg-current',
        )} />
      )}
      {children}
    </span>
  )
}

// ─── GlowIcon ────────────────────────────────────────────────────
// Icon wrapper with ambient glow matching a given color.

export function GlowIcon({
  children,
  color = 'violet',
  size = 'md',
  className,
}: {
  children: ReactNode
  color?: 'violet' | 'emerald' | 'red' | 'amber' | 'blue' | 'cyan'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const colors = {
    violet:  { bg: 'bg-violet-600/15', border: 'border-violet-600/25', icon: 'text-violet-400', shadow: 'rgba(124,58,237,0.3)' },
    emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', icon: 'text-emerald-400', shadow: 'rgba(16,185,129,0.3)' },
    red:     { bg: 'bg-red-500/15', border: 'border-red-500/25', icon: 'text-red-400', shadow: 'rgba(239,68,68,0.3)' },
    amber:   { bg: 'bg-amber-500/15', border: 'border-amber-500/25', icon: 'text-amber-400', shadow: 'rgba(245,158,11,0.3)' },
    blue:    { bg: 'bg-blue-500/15', border: 'border-blue-500/25', icon: 'text-blue-400', shadow: 'rgba(59,130,246,0.3)' },
    cyan:    { bg: 'bg-cyan-500/15', border: 'border-cyan-500/25', icon: 'text-cyan-400', shadow: 'rgba(6,182,212,0.3)' },
  }
  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  }

  const cfg = colors[color]

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border',
        cfg.bg, cfg.border, cfg.icon,
        sizes[size],
        className,
      )}
      style={{ boxShadow: `0 0 16px ${cfg.shadow}` }}
    >
      {children}
    </div>
  )
}

// ─── AIInsightStrip ──────────────────────────────────────────────
// Animated AI insight / message bar.

export function AIInsightStrip({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3',
        'border border-violet-600/20 bg-violet-600/8',
        className,
      )}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 text-[11px]">
        ✦
      </div>
      <p className="text-xs text-zinc-300">
        <span className="font-semibold text-violet-400">IA: </span>
        {message}
      </p>
      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400 ai-pulse shrink-0" />
    </motion.div>
  )
}

// ─── ExecuteButton ───────────────────────────────────────────────
// Themed execute button with gradient + glow + loading state.

export function ExecuteButton({
  onExecute,
  label = 'Executar',
  size = 'md',
}: {
  onExecute: () => void
  label?: string
  size?: 'sm' | 'md'
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  function handleClick() {
    if (state !== 'idle') return
    setState('loading')
    onExecute()
    setTimeout(() => setState('done'), 1200)
    setTimeout(() => setState('idle'), 2800)
  }

  const sizes = size === 'sm'
    ? 'px-3 py-1.5 text-[11px]'
    : 'px-4 py-2 text-xs'

  return (
    <motion.button
      whileHover={state === 'idle' ? { scale: 1.04 } : {}}
      whileTap={state === 'idle' ? { scale: 0.96 } : {}}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1.5 rounded-xl font-semibold text-white transition-all',
        sizes,
        state === 'done'
          ? 'bg-emerald-600'
          : 'bg-violet-600 hover:bg-violet-500',
      )}
      style={state === 'idle' ? { boxShadow: '0 0 16px rgba(124,58,237,0.35)' } : undefined}
    >
      <AnimatePresence mode="wait">
        {state === 'loading' ? (
          <motion.div key="spin"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"
          />
        ) : state === 'done' ? (
          <motion.span key="done"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          >✓ Executado</motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
