'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Zap, ArrowRight, Activity, Star } from 'lucide-react'
import { cn } from '@/lib/cn'

const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    desc: 'Para quem está começando a ter clareza financeira.',
    preco: { mensal: 197, anual: 147 },
    destaque: false,
    badge: null,
    features: [
      'Dashboard financeiro completo',
      'Alertas automáticos de anomalias',
      'Diagnóstico mensal com IA',
      'Benchmarking do setor',
      '1 empresa conectada',
      'Suporte por e-mail',
    ],
    cta: 'Começar grátis por 7 dias',
  },
  {
    id: 'pro',
    nome: 'Pro',
    desc: 'Para negócios que querem crescer com decisões baseadas em dados.',
    preco: { mensal: 397, anual: 297 },
    destaque: true,
    badge: 'Mais popular',
    features: [
      'Tudo do Starter, mais:',
      'Análise preditiva de fluxo de caixa',
      'Recomendações semanais de IA',
      'Alertas em tempo real (WhatsApp)',
      'Relatório executivo automatizado',
      'Até 3 empresas conectadas',
      'Suporte prioritário',
      'Onboarding com especialista',
    ],
    cta: 'Ativar Pro por 7 dias grátis',
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    desc: 'Para grupos e operações com múltiplas unidades.',
    preco: { mensal: 897, anual: 697 },
    destaque: false,
    badge: null,
    features: [
      'Tudo do Pro, mais:',
      'Empresas ilimitadas',
      'IA customizada por segmento',
      'Integração ERP/CRM via API',
      'Relatórios white-label',
      'SLA garantido',
      'Customer Success dedicado',
    ],
    cta: 'Falar com especialista',
  },
]

export default function PlanosPage() {
  const [anual, setAnual] = useState(true)

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 top-0 h-[500px] w-[500px] rounded-full bg-violet-700/8 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-blue-700/6 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            <span className="text-violet-400">N</span>EXUS
          </span>
        </Link>
        <Link href="/resultado" className="text-sm text-zinc-500 hover:text-zinc-300 transition">
          ← Ver diagnóstico
        </Link>
      </nav>

      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-violet-400">
            Escolha seu plano
          </p>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            Ative o NEXUS e{' '}
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 60%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              pare de perder dinheiro
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            7 dias grátis. Sem cartão de crédito. Cancele quando quiser.
          </p>

          {/* Toggle mensal/anual */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            <button
              onClick={() => setAnual(false)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                !anual ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnual(true)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                anual ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              Anual
              <span className="rounded-md bg-emerald-600/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-400">
                -25%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Planos */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANOS.map((plano, i) => (
            <motion.div
              key={plano.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-2xl border p-6',
                plano.destaque
                  ? 'border-violet-600/60 bg-gradient-to-b from-violet-950/40 to-zinc-950 shadow-[0_0_40px_rgba(124,58,237,0.15)]'
                  : 'border-zinc-800 bg-zinc-900/60',
              )}
            >
              {/* Top glow for destaque */}
              {plano.destaque && (
                <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
              )}

              {/* Badge */}
              {plano.badge && (
                <div className="absolute -top-px right-6">
                  <div className="flex items-center gap-1 rounded-b-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    {plano.badge}
                  </div>
                </div>
              )}

              {/* Plan info */}
              <div className="mb-5">
                <h2 className={cn(
                  'mb-1 text-lg font-bold',
                  plano.destaque ? 'text-violet-300' : 'text-white',
                )}>
                  {plano.nome}
                </h2>
                <p className="text-sm text-zinc-500">{plano.desc}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    R$ {anual ? plano.preco.anual : plano.preco.mensal}
                  </span>
                  <span className="mb-1 text-sm text-zinc-500">/mês</span>
                </div>
                {anual && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Cobrado R$ {plano.preco.anual * 12} anualmente
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-2.5">
                {plano.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <Check className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      plano.destaque ? 'text-violet-400' : 'text-emerald-500',
                    )} />
                    <span className={cn(
                      'text-sm',
                      feat.includes('Tudo do') ? 'font-medium text-zinc-300' : 'text-zinc-400',
                    )}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plano.id === 'enterprise' ? '/start' : '/signup'}
                className={cn(
                  'group flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]',
                  plano.destaque
                    ? 'bg-violet-600 text-white shadow-[0_0_24px_rgba(124,58,237,0.3)] hover:bg-violet-500 hover:shadow-[0_0_32px_rgba(124,58,237,0.45)]'
                    : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white',
                )}
              >
                {plano.destaque && <Zap className="h-4 w-4" />}
                {plano.cta}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center"
        >
          <p className="mb-1 text-base font-semibold text-white">
            Garantia de 7 dias sem risco
          </p>
          <p className="text-sm text-zinc-400">
            Se em 7 dias você não ver valor, devolvemos tudo. Sem perguntas,
            sem burocracia. Porque estamos confiantes que você vai ver.
          </p>
        </motion.div>

        {/* FAQ rápido */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {[
            { q: 'Preciso de cartão para o trial?', a: 'Não. O período de 7 dias é 100% grátis, sem cadastro de cartão.' },
            { q: 'Posso mudar de plano depois?', a: 'Sim. Você pode fazer upgrade ou downgrade a qualquer momento, com ajuste proporcional.' },
            { q: 'Como funciona a conexão de dados?', a: 'Integração via planilha, API ou importação manual. Nenhum acesso bancário direto necessário.' },
            { q: 'O diagnóstico gerado é salvo?', a: 'Sim. Ao ativar sua conta, seu diagnóstico inicial fica salvo e atualizado automaticamente.' },
          ].map((item) => (
            <div key={item.q} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="mb-1 text-sm font-semibold text-zinc-200">{item.q}</p>
              <p className="text-sm text-zinc-500">{item.a}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
