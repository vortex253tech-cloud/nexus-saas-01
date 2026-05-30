// lib/plan-middleware.ts
// Server-side plan guard helpers for API routes.
// Usage: const denied = await denyIfCannot('whatsapp'); if (denied) return denied;

import { NextResponse }             from 'next/server'
import { getAuthContext }           from '@/lib/auth'
import {
  canAccess, isWithinLimit, isAtLeast, PLAN_DISPLAY, getLimit,
  type Plan, type PlanFeature, type PlanLimit,
} from '@/lib/nexus-plan'

// ── Result shape from plan checks ────────────────────────────────────────────

export interface PlanCheckResult {
  allowed:      boolean
  plan:         Plan
  required?:    Plan
  limit?:       number
  current?:     number
  errorCode?:   'UNAUTHORIZED' | 'PLAN_REQUIRED' | 'LIMIT_REACHED' | 'SUBSCRIPTION_INACTIVE'
  errorMessage?: string
}

// ── Get plan from auth context ────────────────────────────────────────────────

export async function getCallerPlan(): Promise<Plan | null> {
  const ctx = await getAuthContext()
  return ctx ? ctx.effectivePlan : null
}

// ── Feature access guard ──────────────────────────────────────────────────────
// Returns a 403 Response if the caller's plan cannot access the feature,
// or null if access is granted.

export async function denyIfCannot(
  feature: PlanFeature,
): Promise<NextResponse | null> {
  const ctx = await getAuthContext()

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const plan = ctx.effectivePlan

  if (!canAccess(plan, feature)) {
    // Determine which plan is needed
    const order: Plan[] = ['starter', 'pro', 'scale', 'enterprise']
    const required      = order.find(p => canAccess(p, feature)) ?? 'enterprise'
    return NextResponse.json({
      error:         `Recurso disponível no plano ${PLAN_DISPLAY[required]}`,
      code:          'PLAN_REQUIRED',
      required_plan: required,
      current_plan:  plan,
    }, { status: 403 })
  }

  return null
}

// ── Limit guard ───────────────────────────────────────────────────────────────
// Returns a 403 Response if the caller has hit a plan limit, or null if within limit.

export async function denyIfAtLimit(
  limit: PlanLimit,
  current: number,
): Promise<NextResponse | null> {
  const ctx = await getAuthContext()

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const plan = ctx.effectivePlan

  if (!isWithinLimit(plan, limit, current)) {
    return NextResponse.json({
      error:        `Limite do plano atingido`,
      code:         'LIMIT_REACHED',
      limit,
      current,
      max:          getLimit(plan, limit),
      current_plan: plan,
    }, { status: 403 })
  }

  return null
}

// ── Plan tier guard ───────────────────────────────────────────────────────────
// Shorthand: deny if caller is below a minimum plan tier.

export async function requirePlan(minimum: Plan): Promise<NextResponse | null> {
  const ctx = await getAuthContext()

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!isAtLeast(ctx.effectivePlan, minimum)) {
    return NextResponse.json({
      error:         `Requer plano ${PLAN_DISPLAY[minimum]} ou superior`,
      code:          'PLAN_REQUIRED',
      required_plan: minimum,
      current_plan:  ctx.effectivePlan,
    }, { status: 403 })
  }

  return null
}

// ── Subscription status guard ─────────────────────────────────────────────────
// Ensures the subscription is active (not past_due / canceled / expired).

export async function requireActiveSubscription(): Promise<NextResponse | null> {
  const ctx = await getAuthContext()

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const sub = ctx.subscription
  if (sub && (sub.status === 'past_due' || sub.status === 'canceled')) {
    return NextResponse.json({
      error: 'Assinatura inativa. Atualize seu plano para continuar.',
      code:  'SUBSCRIPTION_INACTIVE',
      subscription_status: sub.status,
    }, { status: 402 })
  }

  return null
}
