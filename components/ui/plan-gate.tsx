'use client'

// components/ui/plan-gate.tsx
// Universal plan gate UI. Use <PlanGate> to wrap any feature behind a plan check.
// For server-side API guards see lib/plan-middleware.ts.

import React from 'react'
import Link from 'next/link'
import { Lock, ArrowUpRight, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  canAccess, requiredPlanFor, PLAN_DISPLAY, FEATURE_LABEL,
  type Plan, type PlanFeature,
} from '@/lib/nexus-plan'

// ── PlanGate ─────────────────────────────────────────────────────────────────
// Wraps children. If plan can't access the feature, shows a lock overlay instead.

interface PlanGateProps {
  feature:  PlanFeature
  plan:     Plan
  children: React.ReactNode
  /** 'overlay' = lock badge over blurred children (default)
   *  'hide'    = render nothing
   *  'replace' = show lock card instead of children
   */
  mode?:    'overlay' | 'hide' | 'replace'
  className?: string
}

export function PlanGate({ feature, plan, children, mode = 'overlay', className }: PlanGateProps) {
  if (canAccess(plan, feature)) return <>{children}</>

  if (mode === 'hide') return null

  const required      = requiredPlanFor(feature)
  const requiredLabel = PLAN_DISPLAY[required]
  const featureLabel  = FEATURE_LABEL[feature] ?? feature

  if (mode === 'replace') {
    return <UpgradeCard requiredPlan={requiredLabel} feature={featureLabel} className={className} />
  }

  // overlay mode — blur + lock badge over children
  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none select-none blur-[2px] opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <UpgradeBadge requiredPlan={requiredLabel} feature={featureLabel} />
      </div>
    </div>
  )
}

// ── UpgradeBadge ─────────────────────────────────────────────────────────────
// Compact lock badge — used inside overlays

export function UpgradeBadge({
  requiredPlan,
  feature,
  className,
}: {
  requiredPlan: string
  feature?: string
  className?: string
}) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-3 bg-zinc-950/95 border border-violet-500/40 rounded-2xl px-6 py-5 shadow-2xl backdrop-blur-sm text-center max-w-xs',
      className,
    )}>
      <div className="w-10 h-10 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
        <Lock className="w-5 h-5 text-violet-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-white">
          🔒 {feature ? `${feature} — ` : ''}Plano {requiredPlan}
        </p>
        <p className="text-xs text-zinc-500">
          Faça upgrade para desbloquear este recurso
        </p>
      </div>
      <Link
        href="/dashboard/upgrade"
        className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40"
      >
        FAZER UPGRADE
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

// ── UpgradeCard ──────────────────────────────────────────────────────────────
// Full page-sized card shown when the entire page/section is locked

export function UpgradeCard({
  requiredPlan,
  feature,
  className,
}: {
  requiredPlan: string
  feature?: string
  className?: string
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6',
      className,
    )}>
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-10 h-10 text-violet-400/60" />
        </div>
        <div className="absolute inset-0 rounded-3xl border border-violet-500/15 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold text-white">
          {feature ?? 'Recurso'} Disponível no Plano {requiredPlan}
        </h2>
        <p className="text-sm text-zinc-400">
          Faça upgrade para desbloquear {feature ? `o ${feature}` : 'este recurso'} e
          acelerar o crescimento do seu negócio com inteligência artificial.
        </p>
      </div>
      <Link
        href="/dashboard/upgrade"
        className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-xl shadow-violet-600/30 hover:shadow-violet-500/40 hover:scale-[1.02]"
      >
        <Zap className="w-4 h-4" />
        FAZER UPGRADE
        <ArrowUpRight className="w-4 h-4" />
      </Link>
      <p className="text-xs text-zinc-600">7 dias grátis · Cancele quando quiser</p>
    </div>
  )
}

// ── PlanLockBadge ────────────────────────────────────────────────────────────
// Inline pill badge for nav items, buttons, etc.

export function PlanLockBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-1.5 py-0.5 leading-none">
      <Lock className="w-2 h-2" />
      {plan}
    </span>
  )
}

// ── LimitBadge ───────────────────────────────────────────────────────────────
// Shows "X / Y usados" with upgrade prompt when at limit

export function LimitBadge({
  current,
  max,
  label,
  plan,
  className,
}: {
  current:   number
  max:       number
  label:     string
  plan:      Plan
  className?: string
}) {
  if (max === -1) return null  // unlimited — show nothing
  const pct  = Math.min(100, Math.round((current / max) * 100))
  const full = current >= max

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border p-3 text-xs',
      full ? 'border-orange-500/30 bg-orange-500/8' : 'border-zinc-800 bg-zinc-900',
      className,
    )}>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn('font-semibold', full ? 'text-orange-400' : 'text-zinc-400')}>{label}</span>
          <span className={cn('font-bold tabular-nums', full ? 'text-orange-400' : 'text-zinc-300')}>
            {current} / {max}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', full ? 'bg-orange-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {full && (
        <Link
          href="/dashboard/upgrade"
          className="shrink-0 text-[10px] font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg px-2.5 py-1.5 transition whitespace-nowrap"
        >
          Upgrade →
        </Link>
      )}
    </div>
  )
}
