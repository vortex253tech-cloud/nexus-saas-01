'use client'

// lib/hooks/use-plan.ts
// Client-side hook to get the current user's effective plan.
// Caches in sessionStorage to avoid repeated /api/auth/session calls.

import { useEffect, useState } from 'react'
import type { Plan } from '@/lib/nexus-plan'

const CACHE_KEY   = 'nexus:effective_plan'
const CACHE_TTL   = 5 * 60 * 1000 // 5 min

interface CacheEntry { plan: Plan; ts: number }

function readCache(): Plan | null {
  try {
    const raw  = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { plan, ts } = JSON.parse(raw) as CacheEntry
    if (Date.now() - ts > CACHE_TTL) return null
    return plan
  } catch { return null }
}

function writeCache(plan: Plan) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ plan, ts: Date.now() })) } catch { /* ignore */ }
}

export function clearPlanCache() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

export function usePlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(() => readCache())

  useEffect(() => {
    if (plan) return  // already have cached value

    let cancelled = false
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then((d: { user?: { effectivePlan?: string } } | null) => {
        if (cancelled) return
        const p = (d?.user?.effectivePlan ?? 'free') as Plan
        writeCache(p)
        setPlan(p)
      })
      .catch(() => { if (!cancelled) setPlan('free') })

    return () => { cancelled = true }
  }, [plan])

  return plan
}
