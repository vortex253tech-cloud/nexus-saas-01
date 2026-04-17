'use client'

// ─── /onboarding ──────────────────────────────────────────────
// Multi-step onboarding wizard.
// Reads initial data from sessionStorage (set by /start).
// Saves progress incrementally after each step (POST /api/leads).
// Personalizes questions and suggestions based on `perfil`.
// On complete → saves resultado to sessionStorage → redirects to /resultado

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Check, Building2, Target, Zap, ArrowRight } from 'lucide-react'
import {
  PERFIL_CONFIG,
  REVENUE_OPTIONS,
  SETORES,
  type Perfil,
  type LeadRespostas,
} from '@/lib/types'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────

interface StartParams {
  nome?: string
  email?: string
  perfil?: string
  fonte?: string
  meta?: string
  empresa?: string
  setor?: string
  stage?: string
  revenueRange?: string
  teamSize?: string
}

// ─── Step indicator ───────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === current ? 'w-6 bg-violet-500' : i < current ? 'w-3 bg-violet-800' : 'w-3 bg-zinc-700',
          )}
        />
      ))}
    </div>
  )
}

// ─── Quiz badge (shows pre-filled fields) ─────────────────────

function QuizBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-violet-950/60 px-2 py-0.5 text-xs font-medium text-violet-400 ring-1 ring-violet-800/50">
      <Zap className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ─── Perfil tile ──────────────────────────────────────────────

const PERFIS: { value: Perfil; label: string; emoji: string; desc: string }[] = [
  { value: 'ecommerce', label: 'E-commerce', emoji: '🛒', desc: 'Loja online, marketplace' },
  { value: 'servicos', label: 'Serviços', emoji: '🤝', desc: 'Agência, freelancer, B2B' },
  { value: 'tech', label: 'Tech / SaaS', emoji: '⚡', desc: 'Software, produto digital' },
  { value: 'consultoria', label: 'Consultoria', emoji: '📊', desc: 'Consultores, coaches' },
  { value: 'varejo', label: 'Varejo', emoji: '🏪', desc: 'Loja física, retail' },
  { value: 'outro', label: 'Outro', emoji: '🏢', desc: 'Outros segmentos' },
]

// ─── Animation variants ───────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

// ─── Main component ───────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [params, setParams] = useState<StartParams>({})
  const [leadId, setLeadId] = useState<string | null>(null)

  // Wizard state
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)

  // Answers
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [setor, setSetor] = useState('')
  const [metaMensal, setMetaMensal] = useState<number | null>(null)
  const [principalDesafio, setPrincipalDesafio] = useState('')

  // Load params from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus_start_params')
      if (raw) {
        const p: StartParams = JSON.parse(raw)
        setParams(p)

        // Pre-fill from URL params
        if (p.perfil && PERFIS.find((x) => x.value === p.perfil)) {
          setPerfil(p.perfil as Perfil)
        }
        if (p.empresa) setNomeEmpresa(p.empresa)
        if (p.setor) setSetor(p.setor)
        if (p.meta) setMetaMensal(Number(p.meta))
      }
    } catch {
      // ignore
    }
  }, [])

  // Derived config based on selected perfil
  const config = perfil ? PERFIL_CONFIG[perfil] : null

  // If setor not yet set and we have a perfil with a default, apply it
  useEffect(() => {
    if (perfil && !setor && config?.setorDefault) {
      setSetor(config.setorDefault)
    }
  }, [perfil, config, setor])

  // Save progress to /api/leads after each step
  const saveProgress = useCallback(
    async (extraRespostas: Partial<LeadRespostas> = {}) => {
      if (!params.email && !params.nome && !nomeEmpresa) return

      const respostas: LeadRespostas = {
        ...(nomeEmpresa && { nomeEmpresa }),
        ...(setor && { setor }),
        ...(metaMensal && { metaMensal }),
        ...(principalDesafio && { principalDesafio }),
        ...(params.stage && { stage: params.stage }),
        ...(params.revenueRange && { revenueRange: params.revenueRange }),
        ...(params.teamSize && { teamSize: params.teamSize }),
        ...extraRespostas,
      }

      try {
        setSaving(true)
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: params.nome ?? null,
            email: params.email ?? null,
            perfil,
            respostas,
            fonte: params.fonte ?? 'direct',
          }),
        })
        const data = await res.json()
        if (data.lead?.id && !leadId) setLeadId(data.lead.id)
      } catch {
        // Silently continue
      } finally {
        setSaving(false)
      }
    },
    [params, perfil, nomeEmpresa, setor, metaMensal, principalDesafio, leadId],
  )

  const TOTAL_STEPS = 4

  function goNext() {
    setDirection(1)
    setStep((s) => s + 1)
  }

  function goBack() {
    setDirection(-1)
    setStep((s) => s - 1)
  }

  async function handlePerfilNext() {
    await saveProgress()
    goNext()
  }

  async function handleEmpresaNext() {
    await saveProgress({ nomeEmpresa })
    goNext()
  }

  async function handleMetaNext() {
    await saveProgress({ metaMensal: metaMensal ?? undefined })
    goNext()
  }

  async function handleDesafioSubmit() {
    await saveProgress({ principalDesafio })

    // Persist complete answers for /resultado to consume
    sessionStorage.setItem(
      'nexus_resultado',
      JSON.stringify({
        perfil,
        nomeEmpresa,
        setor,
        metaMensal,
        principalDesafio,
        leadId,
        nome: params.nome,
        email: params.email,
        stage: params.stage,
        revenueRange: params.revenueRange,
        teamSize: params.teamSize,
      }),
    )

    router.push('/resultado')
  }

  // ── Wizard shell ────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight text-white">
          <span className="text-violet-500">N</span>EXUS
        </span>
        <StepDots total={TOTAL_STEPS} current={step} />
      </header>

      {/* Steps */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ── Step 0: Perfil ──────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step-perfil"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="w-full max-w-lg"
            >
              <div className="mb-8">
                <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
                  Passo 1 de {TOTAL_STEPS}
                </p>
                <h2 className="text-2xl font-semibold text-white leading-snug">
                  Qual é o tipo do seu negócio?
                </h2>
                <p className="mt-2 text-zinc-400">
                  Isso personaliza todo o diagnóstico para a sua realidade.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PERFIS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPerfil(p.value)}
                    className={cn(
                      'relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                      perfil === p.value
                        ? 'border-violet-500 bg-violet-600/10 ring-1 ring-violet-500/50'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600',
                    )}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{p.label}</p>
                      <p className="text-xs text-zinc-500">{p.desc}</p>
                    </div>
                    {perfil === p.value && (
                      <Check className="absolute right-3 top-3 h-3.5 w-3.5 text-violet-400" />
                    )}
                  </button>
                ))}
              </div>

              {params.perfil && params.perfil === perfil && (
                <div className="mt-4 flex items-center gap-2">
                  <QuizBadge label="Respondido no quiz" />
                  <span className="text-xs text-zinc-500">Pode alterar se necessário</span>
                </div>
              )}

              <button
                onClick={handlePerfilNext}
                disabled={!perfil || saving}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-medium text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Continuar'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ── Step 1: Empresa ─────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step-empresa"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="w-full max-w-lg"
            >
              <div className="mb-8">
                <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
                  Passo 2 de {TOTAL_STEPS}
                </p>
                <h2 className="text-2xl font-semibold text-white leading-snug">
                  {config ? `Como se chama o seu ${config.label.toLowerCase()}?` : 'Qual o nome da sua empresa?'}
                </h2>
                {config && (
                  <p className="mt-2 text-zinc-400">
                    Vamos usar isso para personalizar o seu painel.
                  </p>
                )}
              </div>

              {/* Nome da empresa */}
              <div className="mb-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                  Nome da empresa
                  {params.empresa && <QuizBadge label="do quiz" />}
                </label>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  placeholder={config ? `Ex: ${config.label} do João` : 'Nome da empresa'}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                />
              </div>

              {/* Setor */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Setor
                  {params.setor && <QuizBadge label="do quiz" />}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(config
                    ? [config.setorDefault, ...SETORES.filter((s) => s !== config.setorDefault)]
                    : SETORES
                  )
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => setSetor(s)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm transition-all',
                          setor === s
                            ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                </div>
              </div>

              {/* Pre-filled context from quiz */}
              {(params.stage || params.teamSize || params.revenueRange) && (
                <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Informações do quiz
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {params.stage && (
                      <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                        Estágio: <span className="text-zinc-300">{params.stage}</span>
                      </span>
                    )}
                    {params.teamSize && (
                      <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                        Time: <span className="text-zinc-300">{params.teamSize}</span>
                      </span>
                    )}
                    {params.revenueRange && (
                      <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                        Faturamento: <span className="text-zinc-300">{params.revenueRange}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-300"
                >
                  Voltar
                </button>
                <button
                  onClick={handleEmpresaNext}
                  disabled={!nomeEmpresa.trim() || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Salvando…' : 'Continuar'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Meta ────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step-meta"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="w-full max-w-lg"
            >
              <div className="mb-8">
                <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
                  Passo 3 de {TOTAL_STEPS}
                </p>
                <h2 className="text-2xl font-semibold text-white leading-snug">
                  Qual é a sua meta de faturamento?
                </h2>
                <p className="mt-2 text-zinc-400">
                  {config
                    ? `Para um ${config.label.toLowerCase()}, o mais comum é R$ ${(config.metaSugerida / 1000).toFixed(0)}k/mês.`
                    : 'Isso define o benchmark e as análises do seu painel.'}
                </p>
                {params.meta && <QuizBadge label="Respondido no quiz" />}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {REVENUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMetaMensal(opt.value)}
                    className={cn(
                      'relative flex flex-col items-start rounded-xl border p-4 text-left transition-all',
                      metaMensal === opt.value
                        ? 'border-violet-500 bg-violet-600/10 ring-1 ring-violet-500/50'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600',
                      config?.metaSugerida === opt.value &&
                        metaMensal !== opt.value &&
                        'border-zinc-600',
                    )}
                  >
                    <span className="text-sm font-medium text-white">{opt.label}</span>
                    {config?.metaSugerida === opt.value && (
                      <span className="mt-1 text-xs text-violet-400">Sugerido</span>
                    )}
                    {metaMensal === opt.value && (
                      <div className="absolute right-3 top-3">
                        <Check className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-500"
                >
                  Voltar
                </button>
                <button
                  onClick={handleMetaNext}
                  disabled={!metaMensal || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Salvando…' : 'Continuar'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Desafio ─────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step-desafio"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="w-full max-w-lg"
            >
              <div className="mb-8">
                <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
                  Passo 4 de {TOTAL_STEPS}
                </p>
                <h2 className="text-2xl font-semibold text-white leading-snug">
                  Qual é o seu principal desafio financeiro?
                </h2>
                <p className="mt-2 text-zinc-400">
                  {config
                    ? `Os desafios mais comuns de ${config.label.toLowerCase()}:`
                    : 'Assim conseguimos focar o que importa.'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {(config?.desafios ?? [
                  { value: 'fluxo', label: 'Fluxo de caixa' },
                  { value: 'custos', label: 'Controle de custos' },
                  { value: 'crescimento', label: 'Crescimento de receita' },
                  { value: 'visibilidade', label: 'Visibilidade financeira' },
                ]).map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setPrincipalDesafio(d.value)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all',
                      principalDesafio === d.value
                        ? 'border-violet-500 bg-violet-600/10 text-violet-300'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600',
                    )}
                  >
                    <span className="text-sm font-medium">{d.label}</span>
                    {principalDesafio === d.value && (
                      <Check className="h-4 w-4 text-violet-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Summary card before submit */}
              {principalDesafio && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-medium text-zinc-300">Resumo do diagnóstico</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-zinc-800 p-2.5">
                      <p className="text-zinc-500">Negócio</p>
                      <p className="text-zinc-200 font-medium">{nomeEmpresa || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-zinc-800 p-2.5">
                      <p className="text-zinc-500">Tipo</p>
                      <p className="text-zinc-200 font-medium">
                        {perfil ? PERFIL_CONFIG[perfil].label : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-zinc-800 p-2.5">
                      <p className="text-zinc-500">Meta mensal</p>
                      <p className="text-zinc-200 font-medium">
                        {metaMensal
                          ? `R$ ${(metaMensal / 1000).toFixed(0)}k`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-zinc-800 p-2.5">
                      <p className="text-zinc-500">Setor</p>
                      <p className="text-zinc-200 font-medium">{setor || '—'}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={goBack}
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-500"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDesafioSubmit}
                  disabled={!principalDesafio || saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Salvando…' : 'Quero meu diagnóstico'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-zinc-700">
        NEXUS — Seu COO de IA · nexus.com.br
      </footer>
    </div>
  )
}
