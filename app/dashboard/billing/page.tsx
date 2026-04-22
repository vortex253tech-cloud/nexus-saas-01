'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, CheckCircle2, Zap, Shield, TrendingUp,
  Sparkles, ArrowRight, Star,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import Link from 'next/link'
import { getNumber, getString, isRecord } from '@/lib/unknown'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Plans ────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Grátis',
    price: 0,
    badge: null,
    description: 'Para testar o poder da IA financeira.',
    features: [
      '1 diagnóstico por mês',
      '3 ações geradas por IA',
      '2 alertas ativos',
      'Dashboard básico',
      'Sem execução automática',
    ],
    missing: ['Email automático', 'WhatsApp', 'Histórico completo'],
    cta: 'Plano atual',
    color: 'border-zinc-700',
    btnClass: 'bg-zinc-800 text-zinc-400 cursor-default',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 197,
    badge: 'Mais popular',
    description: 'Para empresas que querem execução real.',
    features: [
      'Diagnósticos ilimitados',
      '10 ações geradas por IA/mês',
      '10 alertas ativos',
      'Envio de e-mail automático',
      'Histórico completo',
      'Suporte por email',
    ],
    missing: ['WhatsApp automático', 'Multi-usuário'],
    cta: 'Assinar Starter',
    color: 'border-violet-500/60',
    btnClass: 'bg-violet-600 text-white hover:bg-violet-500',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 397,
    badge: 'Melhor ROI',
    description: 'Para empresas sérias em crescimento.',
    features: [
      'Diagnósticos ilimitados',
      'Ações ilimitadas',
      'Alertas ilimitados',
      'Email + WhatsApp automático',
      'Histórico completo',
      'Relatórios avançados',
      'Suporte prioritário',
      'Multi-usuário (até 3)',
    ],
    missing: [],
    cta: 'Assinar Pro',
    color: 'border-emerald-500/60',
    btnClass: 'bg-emerald-600 text-white hover:bg-emerald-500',
  },
]

// ─── Page ─────────────────────────────────────────────────────

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [ganho, setGanho] = useState(0)

  useEffect(() => {
    // Read ganho from sessionStorage
    try {
      const raw = sessionStorage.getItem('nexus_resultado')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isRecord(parsed)) {
          const plan = getString(parsed, 'plan')
          const ganhoPotencial = getNumber(parsed, 'ganho_potencial')
          if (plan) setCurrentPlan(plan)
          if (ganhoPotencial) setGanho(ganhoPotencial)
        }
      }
      const g = sessionStorage.getItem('nexus_ganho_potencial')
      if (g) setGanho(Number(g))
    } catch { /* ok */ }

    // Also resolve company to get plan from auth session
    void resolveCompanyId().then(async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const json = await res.json() as { user?: { plan?: string } }
          if (json.user?.plan) setCurrentPlan(json.user.plan as 'free' | 'pro' | 'enterprise')
        }
      } catch { /* ok */ }
    })
  }, [])

  function handleUpgrade(planId: string) {
    if (planId === 'free') return
    sessionStorage.setItem('nexus_ganho_potencial', String(ganho))
    window.location.href = '/dashboard/upgrade'
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <CreditCard size={22} className="text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Plano & Billing</h1>
        </div>
        <p className="text-zinc-500 text-sm">Escolha o plano certo para o tamanho da sua ambição.</p>
      </div>

      {/* ROI Banner */}
      {ganho > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex items-center gap-3"
        >
          <TrendingUp size={20} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              A IA identificou R$ {Math.round(ganho).toLocaleString('pt-BR')}/mês em ganho potencial
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Assinar o Pro custa R$ 397 e libera todo esse potencial automaticamente.
            </p>
          </div>
        </motion.div>
      )}

      {/* Plans */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const isCurrent = plan.id === currentPlan
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'relative rounded-2xl border p-6 flex flex-col',
                plan.color,
                isCurrent ? 'bg-violet-600/5' : 'bg-zinc-900/60',
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold text-white">
                    <Star size={10} /> {plan.badge}
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300">
                    Plano atual
                  </span>
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-white">Grátis</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-white">R$ {plan.price}</span>
                      <span className="text-sm text-zinc-500">/mês</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{plan.description}</p>
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
                {plan.missing.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-zinc-600 line-through">
                    <CheckCircle2 size={13} className="shrink-0 text-zinc-700" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || plan.id === 'free'}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                  plan.btnClass,
                  !isCurrent && plan.id !== 'free' && 'active:scale-95',
                )}
              >
                {isCurrent ? 'Plano atual' : plan.cta}
                {!isCurrent && plan.id !== 'free' && <ArrowRight size={14} />}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Security note */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-600">
        <Shield size={12} />
        <span>Pagamento seguro · Cancele a qualquer momento · Sem fidelidade</span>
      </div>
    </div>
  )
}
