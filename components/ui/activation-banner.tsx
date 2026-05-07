'use client'

// Activation Banner — shows post-login when user has potential revenue to recover.
// Appears once per session, dismissible, links to upgrade or data entry.
// Emotionally anchored on the "money you're losing right now."

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingDown, Zap, X, ArrowRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface ActivationBannerProps {
  ganhoEstimado:  number   // potential monthly revenue (BRL)
  nomeEmpresa:    string
  hasData:        boolean  // user has financial data connected
  plan:           string
  overdueAmount?: number   // current overdue amount from canonical metrics
}

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1000).toFixed(0)}k`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export default function ActivationBanner({
  ganhoEstimado,
  nomeEmpresa,
  hasData,
  plan,
  overdueAmount = 0,
}: ActivationBannerProps) {
  const [visible, setVisible]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Only show once per session
    const key = 'nexus_activation_banner_dismissed'
    if (sessionStorage.getItem(key)) return

    // Show only if meaningful value to show
    const shouldShow = ganhoEstimado > 500 || overdueAmount > 500
    if (shouldShow) setVisible(true)
  }, [ganhoEstimado, overdueAmount])

  function dismiss() {
    sessionStorage.setItem('nexus_activation_banner_dismissed', '1')
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
  }

  // Determine message urgency
  const amount      = overdueAmount > 0 ? overdueAmount : ganhoEstimado
  const isOverdue   = overdueAmount > 500
  const isPaidPlan  = plan !== 'free'

  if (!visible) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -16, scaleY: 0.95 }}
          animate={{ opacity: 1, y: 0,   scaleY: 1     }}
          exit={{   opacity: 0, y: -8,   scaleY: 0.95  }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'mb-5 relative overflow-hidden rounded-2xl border p-4',
            isOverdue
              ? 'border-red-500/30 bg-gradient-to-r from-red-950/40 to-zinc-900'
              : 'border-amber-500/30 bg-gradient-to-r from-amber-950/30 to-zinc-900',
          )}
        >
          {/* Glow */}
          <div className={cn(
            'pointer-events-none absolute inset-0 opacity-20',
            isOverdue
              ? 'bg-gradient-to-r from-red-600/20 to-transparent'
              : 'bg-gradient-to-r from-amber-600/20 to-transparent',
          )} />

          <div className="relative flex items-center gap-4">
            {/* Icon */}
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
              isOverdue
                ? 'border-red-500/30 bg-red-500/15'
                : 'border-amber-500/30 bg-amber-500/15',
            )}>
              {isOverdue
                ? <AlertTriangle size={22} className="text-red-400" />
                : <TrendingDown  size={22} className="text-amber-400" />
              }
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-bold leading-tight',
                isOverdue ? 'text-red-300' : 'text-amber-300',
              )}>
                {isOverdue
                  ? `${nomeEmpresa} tem ${fmtBRL(amount)} vencidos agora`
                  : `${nomeEmpresa} está perdendo ${fmtBRL(amount)}/mês`
                }
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {!hasData
                  ? 'Conecte seus dados para ver onde está o dinheiro que você está perdendo.'
                  : isOverdue
                    ? 'Clientes inadimplentes identificados. Ative o Auto-Pilot para cobrar automaticamente.'
                    : 'A IA identificou oportunidades de receita. Ative o Motor para executar.'
                }
              </p>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 shrink-0">
              {!hasData ? (
                <Link
                  href="/dashboard/dados"
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-colors whitespace-nowrap"
                  onClick={dismiss}
                >
                  <Zap size={12} /> Conectar dados
                </Link>
              ) : !isPaidPlan ? (
                <Link
                  href="/dashboard/upgrade"
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
                  style={{ boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
                  onClick={dismiss}
                >
                  <Zap size={12} /> Recuperar agora
                </Link>
              ) : (
                <Link
                  href="/dashboard/financeiro"
                  className="flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-600/15 px-4 py-2 text-xs font-bold text-violet-300 hover:bg-violet-600/25 transition-colors whitespace-nowrap"
                  onClick={dismiss}
                >
                  Ver detalhes <ArrowRight size={12} />
                </Link>
              )}

              <button
                onClick={dismiss}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
