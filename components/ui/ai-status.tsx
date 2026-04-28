'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle2, Zap, Brain } from 'lucide-react'
import { cn } from '@/lib/cn'

export type AIState = 'idle' | 'analyzing' | 'processing' | 'executing' | 'done'

interface AIStatusProps {
  state?: AIState
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

const STATE_CONFIG: Record<AIState, {
  icon: React.ReactNode
  defaultLabel: string
  dotClass: string
  textClass: string
  bgClass: string
  borderClass: string
  animate: boolean
}> = {
  idle: {
    icon: <Brain size={11} />,
    defaultLabel: 'IA pronta',
    dotClass: 'bg-zinc-500',
    textClass: 'text-zinc-500',
    bgClass: 'bg-zinc-800/40',
    borderClass: 'border-zinc-700/40',
    animate: false,
  },
  analyzing: {
    icon: <Brain size={11} />,
    defaultLabel: 'IA analisando',
    dotClass: 'bg-violet-400 ai-pulse',
    textClass: 'text-violet-400',
    bgClass: 'bg-violet-500/8',
    borderClass: 'border-violet-500/20',
    animate: true,
  },
  processing: {
    icon: <Loader2 size={11} />,
    defaultLabel: 'IA processando',
    dotClass: 'bg-amber-400 ai-pulse',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/8',
    borderClass: 'border-amber-500/20',
    animate: true,
  },
  executing: {
    icon: <Zap size={11} />,
    defaultLabel: 'IA executando',
    dotClass: 'bg-blue-400 ai-pulse',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-500/8',
    borderClass: 'border-blue-500/20',
    animate: true,
  },
  done: {
    icon: <CheckCircle2 size={11} />,
    defaultLabel: 'IA concluída',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/8',
    borderClass: 'border-emerald-500/20',
    animate: false,
  },
}

export function AIStatus({ state = 'idle', label, className, size = 'sm' }: AIStatusProps) {
  const cfg = STATE_CONFIG[state]
  const displayLabel = label ?? cfg.defaultLabel

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, scale: 0.92, y: -2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 2 }}
        transition={{ duration: 0.18, type: 'spring', stiffness: 400, damping: 28 }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
          size === 'md' && 'px-3 py-1.5',
          cfg.bgClass,
          cfg.borderClass,
          className,
        )}
      >
        {/* Animated icon */}
        <motion.span
          className={cn('shrink-0', cfg.textClass)}
          animate={cfg.animate && state === 'processing' ? { rotate: 360 } : {}}
          transition={state === 'processing' ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
        >
          {cfg.icon}
        </motion.span>

        {/* Pulsing dot */}
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dotClass)} />

        {/* Label */}
        <span className={cn('font-medium', cfg.textClass, size === 'sm' ? 'text-[10px]' : 'text-xs')}>
          {displayLabel}
        </span>

        {/* Animated dots for active states */}
        {cfg.animate && (
          <span className={cn('flex gap-0.5', cfg.textClass)}>
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="h-0.5 w-0.5 rounded-full bg-current"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.22 }}
              />
            ))}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// Convenience banner variant for page headers
export function AIStatusBanner({
  state = 'idle',
  label,
  className,
}: {
  state?: AIState
  label?: string
  className?: string
}) {
  const cfg = STATE_CONFIG[state]
  if (state === 'idle') return null

  return (
    <AnimatePresence>
      <motion.div
        key={state}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className={cn(
          'overflow-hidden rounded-xl border px-4 py-2.5',
          cfg.bgClass,
          cfg.borderClass,
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className={cfg.textClass} />
          <span className={cn('text-xs font-semibold', cfg.textClass)}>
            {label ?? cfg.defaultLabel}
          </span>
          {cfg.animate && (
            <span className={cn('flex gap-0.5', cfg.textClass)}>
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="h-1 w-1 rounded-full bg-current"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                />
              ))}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
