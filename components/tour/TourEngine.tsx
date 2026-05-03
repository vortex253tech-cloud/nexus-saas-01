'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTour } from '@/lib/tour/context'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const HIGHLIGHT_PAD = 6
const TOOLTIP_GAP   = 16
const TOOLTIP_W     = 320

function getElementRect(selector: string): Rect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top:    r.top    - HIGHLIGHT_PAD,
    left:   r.left   - HIGHLIGHT_PAD,
    width:  r.width  + HIGHLIGHT_PAD * 2,
    height: r.height + HIGHLIGHT_PAD * 2,
  }
}

function computeTooltipStyle(
  rect: Rect | null,
  position: string,
  vw: number,
): React.CSSProperties {
  if (!rect || position === 'center') {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  const midY = rect.top + rect.height / 2
  const midX = rect.left + rect.width / 2

  switch (position) {
    case 'right': {
      const left = rect.left + rect.width + TOOLTIP_GAP
      // Clamp so tooltip doesn't overflow right edge
      const clampedLeft = Math.min(left, vw - TOOLTIP_W - 16)
      return { top: midY, left: clampedLeft, transform: 'translateY(-50%)' }
    }
    case 'left': {
      return {
        top:       midY,
        left:      Math.max(16, rect.left - TOOLTIP_GAP - TOOLTIP_W),
        transform: 'translateY(-50%)',
      }
    }
    case 'bottom': {
      return {
        top:       rect.top + rect.height + TOOLTIP_GAP,
        left:      Math.max(16, Math.min(midX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16)),
        transform: 'none',
      }
    }
    case 'top': {
      return {
        top:       rect.top - TOOLTIP_GAP,
        left:      Math.max(16, Math.min(midX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16)),
        transform: 'translateY(-100%)',
      }
    }
    default:
      return { top: midY, left: rect.left + rect.width + TOOLTIP_GAP, transform: 'translateY(-50%)' }
  }
}

// ─── Tour Engine ───────────────────────────────────────────────────────────

export function TourEngine() {
  const {
    active, currentStep, currentStepIndex, totalSteps,
    next, back, skip, finish, dismiss,
  } = useTour()

  const [rect,    setRect]    = useState<Rect | null>(null)
  const [vw,      setVw]      = useState(1280)
  const [vh,      setVh]      = useState(800)
  const [mounted, setMounted] = useState(false)
  const rafRef = useRef<number>(0)

  // Client-only mount guard (createPortal requires DOM)
  useEffect(() => setMounted(true), [])

  // Track viewport size
  useEffect(() => {
    function update() {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Poll the target element's rect every animation frame so the spotlight
  // smoothly follows if the sidebar animates or the page scrolls.
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    if (!active || !currentStep) { setRect(null); return }

    let retries = 0
    function tick() {
      const r = getElementRect(currentStep!.selector)
      if (r) {
        setRect(r)
        retries = 0
      } else if (retries < 30) {
        // Element not yet rendered — keep trying for ~500ms
        retries++
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, currentStep])

  if (!mounted || !active || !currentStep) return null

  const isFirst = currentStepIndex === 0
  const isLast  = currentStepIndex === totalSteps - 1
  const pct     = Math.round(((currentStepIndex + 1) / totalSteps) * 100)

  const tooltipStyle = computeTooltipStyle(rect, currentStep.position, vw)

  // ── SVG spotlight clip path values ──────────────────────────────────────
  const hasRect = rect !== null
  const rx = hasRect ? rect.left   : 0
  const ry = hasRect ? rect.top    : 0
  const rw = hasRect ? rect.width  : 0
  const rh = hasRect ? rect.height : 0

  const overlay = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9000]" key="tour-overlay">
        {/* ── Backdrop with spotlight cutout ─────────────────────────── */}
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ cursor: 'default' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="nexus-spotlight">
              {/* white = visible backdrop */}
              <rect x={0} y={0} width={vw} height={vh} fill="white" />
              {/* black = cut-out (transparent) */}
              {hasRect && (
                <rect x={rx} y={ry} width={rw} height={rh} rx={10} fill="black" />
              )}
            </mask>
          </defs>

          {/* Dark overlay — click to dismiss */}
          <rect
            x={0} y={0}
            width={vw} height={vh}
            fill="rgba(0,0,0,0.70)"
            mask="url(#nexus-spotlight)"
            onClick={dismiss}
            style={{ cursor: 'pointer' }}
          />

          {/* Violet highlight ring around target */}
          {hasRect && (
            <motion.rect
              key={`ring-${currentStepIndex}`}
              x={rx} y={ry}
              width={rw} height={rh}
              rx={10}
              fill="none"
              stroke="rgb(124,58,237)"
              strokeWidth={2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </svg>

        {/* ── Tooltip card ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              zIndex:   9100,
              width:    TOOLTIP_W,
              maxWidth: `calc(100vw - 32px)`,
              ...tooltipStyle,
            }}
          >
            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden">

              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80">
                {/* Step dots */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          i === currentStepIndex
                            ? 'w-4 bg-violet-500'
                            : i < currentStepIndex
                            ? 'w-1.5 bg-violet-700'
                            : 'w-1.5 bg-zinc-700',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-500">
                    {currentStepIndex + 1} / {totalSteps}
                  </span>
                </div>

                <button
                  onClick={dismiss}
                  className="rounded-lg p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Fechar tour"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pt-4 pb-3 space-y-3">
                <div>
                  <h3 className="text-sm font-bold leading-tight text-white">
                    {currentStep.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    {currentStep.description}
                  </p>
                </div>

                {/* "Progress to Money" bar */}
                <div className="rounded-lg border border-violet-600/20 bg-violet-600/8 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-violet-400 shrink-0">{pct}%</span>
                  </div>
                  <p className="text-[10px] text-violet-400/60">progresso para primeiro resultado</p>
                </div>
              </div>

              {/* Footer / nav */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {!isFirst && (
                    <button
                      onClick={back}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                    >
                      <ChevronLeft size={12} />
                      Voltar
                    </button>
                  )}
                  {currentStep.canSkip && !isLast && (
                    <button
                      onClick={skip}
                      className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-600 transition hover:text-zinc-400"
                    >
                      Pular
                    </button>
                  )}
                </div>

                <button
                  onClick={isLast ? finish : next}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition',
                    isLast
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                      : 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_16px_rgba(124,58,237,0.35)]',
                  )}
                >
                  {isLast ? (
                    <><CheckCircle2 size={13} /> Concluir</>
                  ) : (
                    <>{currentStep.cta ?? 'Próximo'} <ArrowRight size={12} /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
