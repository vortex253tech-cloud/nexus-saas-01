'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TOUR_STEPS, TOTAL_STEPS, type TourStep } from './config'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TourState {
  active: boolean
  currentStepIndex: number
  completed: boolean
  loaded: boolean
}

export interface TourContextValue {
  active: boolean
  loaded: boolean
  currentStep: TourStep | null
  currentStepIndex: number
  totalSteps: number
  completed: boolean
  start: () => void
  next: () => void
  back: () => void
  skip: () => void
  finish: () => void
  dismiss: () => void
}

// ─── Context ───────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside TourProvider')
  return ctx
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [state, setState] = useState<TourState>({
    active: false,
    currentStepIndex: 0,
    completed: false,
    loaded: false,
  })

  // Ref so navigation calls inside state-update callbacks always see the
  // latest pathname without stale closure issues.
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  // ── Persist to DB ────────────────────────────────────────────────────────
  const persist = useCallback(async (step: number, completed: boolean) => {
    try {
      await fetch('/api/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, completed }),
      })
    } catch { /* non-critical */ }
  }, [])

  // ── Load from DB on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/tour')
      .then(r => r.ok ? r.json() : null)
      .then((data: { step?: number; completed?: boolean } | null) => {
        if (!data) { setState(s => ({ ...s, loaded: true })); return }
        const step      = data.step      ?? 0
        const completed = data.completed ?? false
        // Resume if not completed and tour was started (step > 0)
        const stepIndex = Math.max(0, Math.min(step - 1, TOTAL_STEPS - 1))
        setState({
          active: !completed && step > 0,
          currentStepIndex: stepIndex,
          completed,
          loaded: true,
        })
      })
      .catch(() => setState(s => ({ ...s, loaded: true })))
  }, [])

  // ── Navigation helper ────────────────────────────────────────────────────
  const goToStep = useCallback((step: TourStep) => {
    if (pathnameRef.current !== step.page) {
      router.push(step.page)
    }
  }, [router])

  // ── Controls ─────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    setState(s => ({ ...s, active: true, currentStepIndex: 0, completed: false }))
    goToStep(TOUR_STEPS[0])
    persist(1, false)
  }, [goToStep, persist])

  const next = useCallback(() => {
    setState(prev => {
      const nextIdx = prev.currentStepIndex + 1
      if (nextIdx >= TOTAL_STEPS) {
        persist(TOTAL_STEPS + 1, true)
        return { ...prev, active: false, completed: true }
      }
      const nextStep = TOUR_STEPS[nextIdx]
      goToStep(nextStep)
      persist(nextIdx + 1, false)
      return { ...prev, currentStepIndex: nextIdx }
    })
  }, [goToStep, persist])

  const back = useCallback(() => {
    setState(prev => {
      const prevIdx = Math.max(0, prev.currentStepIndex - 1)
      goToStep(TOUR_STEPS[prevIdx])
      return { ...prev, currentStepIndex: prevIdx }
    })
  }, [goToStep])

  const skip = useCallback(() => {
    setState(prev => {
      const step = TOUR_STEPS[prev.currentStepIndex]
      if (!step?.canSkip) return prev
      const nextIdx = prev.currentStepIndex + 1
      if (nextIdx >= TOTAL_STEPS) {
        persist(TOTAL_STEPS + 1, true)
        return { ...prev, active: false, completed: true }
      }
      goToStep(TOUR_STEPS[nextIdx])
      persist(nextIdx + 1, false)
      return { ...prev, currentStepIndex: nextIdx }
    })
  }, [goToStep, persist])

  const finish = useCallback(() => {
    setState(s => ({ ...s, active: false, completed: true }))
    persist(TOTAL_STEPS + 1, true)
  }, [persist])

  const dismiss = useCallback(() => {
    // Dismiss = mark completed so it never auto-shows again
    setState(s => ({ ...s, active: false, completed: true }))
    persist(TOTAL_STEPS + 1, true)
  }, [persist])

  const currentStep = state.active ? (TOUR_STEPS[state.currentStepIndex] ?? null) : null

  return (
    <TourContext.Provider value={{
      active:           state.active,
      loaded:           state.loaded,
      currentStep,
      currentStepIndex: state.currentStepIndex,
      totalSteps:       TOTAL_STEPS,
      completed:        state.completed,
      start,
      next,
      back,
      skip,
      finish,
      dismiss,
    }}>
      {children}
    </TourContext.Provider>
  )
}
