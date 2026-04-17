'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Zap, CheckCircle2, ArrowLeft, Shield, TrendingUp,
  Bot, Bell, BarChart3, Lock, Sparkles, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1000).toFixed(0)}k`
  return `R$ ${v}`
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 197,
    period: 'mês',
    badge: null,
    color: 'border-zinc-700',
    btnClass: 'bg-zinc-800 text-white hover:bg-zinc-700',
    features: [
      '5 insights da IA por análise',
      'Alertas automáticos',
      'Dados financeiros (6 meses)',
      'IA real (Claude CFO)',
      'Histórico de ganhos',
    ],
    notIncluded: ['Auto-Pilot de execução', 'Gráfico de evolução', 'Alertas WhatsApp'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 397,
    period: 'mês',
    badge: 'Mais popular',
    color: 'border-violet-600',
    btnClass: 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_24px_rgba(124,58,237,0.4)]',
    features: [
      'Insights ilimitados da IA',
      'Auto-Pilot de execução',
      'Gráfico de evolução financeira',
      'Alertas WhatsApp + e-mail',
      'Exportar relatórios PDF',
      'Histórico completo',
      'Score antes/depois',
    ],
    notIncluded: [],
  },
]

export default function UpgradePage() {
  const [ganho, setGanho] = useState(0)
  const [nomeEmpresa, setNomeEmpresa] = useState('sua empresa')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus_resultado')
      if (raw) {
        const d = JSON.parse(raw)
        if (d.nomeEmpresa) setNomeEmpresa(d.nomeEmpresa)
      }
      const ganhoRaw = sessionStorage.getItem('nexus_ganho_potencial')
      if (ganhoRaw) setGanho(Number(ganhoRaw))
    } catch {}
  }, [])

  async function handleCheckout(planId: string) {
    setLoading(true)
    // Mock checkout — future Stripe integration point
    await new Promise(r => setTimeout(r, 1500))
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600/20">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Bem-vindo ao Pro!</h1>
          <p className="mb-6 text-zinc-400">Sua conta foi ativada. Todas as funcionalidades estão liberadas.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition"
          >
            Ir para o Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-64 top-0 h-96 w-96 rounded-full bg-violet-700/8 blur-[120px]" />
        <div className="absolute -right-64 bottom-0 h-96 w-96 rounded-full bg-blue-700/6 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          {ganho > 0 && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-700/50 bg-emerald-950/40 px-4 py-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">
                {nomeEmpresa} tem {fmtBRL(ganho)}/mês para recuperar
              </span>
            </div>
          )}
          <h1 className="mb-4 text-4xl font-bold text-white leading-tight">
            Desbloqueie a execução automática
            <br />
            <span className="text-violet-400">e recupere seu dinheiro</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-zinc-400">
            A IA já identificou os problemas. Agora deixe o sistema executar as soluções
            automaticamente — enquanto você foca no negócio.
          </p>
        </motion.div>

        {/* Value proof */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 grid grid-cols-3 gap-4"
        >
          {[
            { icon: Bot, label: 'Auto-Pilot executa ações', sub: 'sem você precisar fazer nada' },
            { icon: Bell, label: 'Alertas em tempo real', sub: 'WhatsApp + e-mail' },
            { icon: BarChart3, label: 'Score sobe visualmente', sub: 'conforme você avança' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
                <item.icon className="h-5 w-5 text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.sub}</p>
            </div>
          ))}
        </motion.div>

        {/* Plans */}
        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className={cn('relative rounded-2xl border p-6', plan.color, plan.id === 'pro' && 'bg-violet-950/20')}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-lg font-bold text-white">{plan.name}</p>
                  {plan.id === 'pro' && <Sparkles className="h-4 w-4 text-violet-400" />}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">R$ {plan.price}</span>
                  <span className="text-sm text-zinc-500">/{plan.period}</span>
                </div>
                {ganho > 0 && plan.id === 'pro' && (
                  <p className="mt-1 text-xs text-emerald-400">
                    ROI estimado: {Math.round(ganho / plan.price)}× nos primeiros 30 dias
                  </p>
                )}
              </div>

              <ul className="mb-6 space-y-2.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
                {plan.notIncluded.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600 line-through">
                    <Lock className="h-4 w-4 shrink-0 text-zinc-700" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading}
                className={cn(
                  'w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]',
                  plan.btnClass,
                  loading && 'opacity-60 cursor-not-allowed',
                )}
              >
                {loading ? 'Processando...' : 'Começar teste grátis de 7 dias'}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-600">Cancele quando quiser. Sem taxa de cancelamento.</p>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-600"
        >
          {[
            { icon: Shield, text: 'Dados criptografados' },
            { icon: CheckCircle2, text: '7 dias grátis' },
            { icon: ArrowLeft, text: 'Cancele a qualquer momento' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-1.5">
              <item.icon className="h-3.5 w-3.5" />
              {item.text}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
