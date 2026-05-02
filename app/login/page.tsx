'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-provider'
import {
  Activity, ArrowRight, Loader2, CheckCircle, CheckCircle2, TrendingUp, Zap, Shield, Sparkles, AlertTriangle,
} from 'lucide-react'

// ─── Onboarding success screen ────────────────────────────────────────────

function OnboardingScreen({ onEnter }: { onEnter: () => void }) {
  useEffect(() => {
    const t = setTimeout(onEnter, 3200)
    return () => clearTimeout(t)
  }, [onEnter])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-600 shadow-[0_0_60px_rgba(124,58,237,0.5)]"
      >
        <Sparkles className="h-10 w-10 text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-3 text-3xl font-extrabold text-white"
      >
        Bem-vindo ao NEXUS.
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="mb-8 max-w-sm text-lg text-zinc-400"
      >
        Vamos gerar sua primeira estratégia em segundos.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.6, duration: 2.2, ease: 'easeInOut' }}
        className="h-0.5 w-48 rounded-full bg-gradient-to-r from-violet-600 via-violet-400 to-violet-600"
        style={{ originX: 0 }}
      />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="mt-4 text-sm text-zinc-600"
      >
        Entrando no sistema…
      </motion.p>
    </motion.div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/dashboard'
  const errorParam   = searchParams.get('error')
  const confirmed    = searchParams.get('confirmed') === '1'

  const { user, loading: authLoading } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(() => {
    if (errorParam === 'link_expired')       return 'Link expirado ou já utilizado. Faça login normalmente.'
    if (errorParam === 'confirmation_failed') return 'Não foi possível confirmar. Tente entrar com e-mail e senha.'
    if (errorParam === 'unexpected')          return 'Ocorreu um erro inesperado. Tente novamente.'
    return null
  })
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    if (!authLoading && user) router.replace(redirect)
  }, [user, authLoading, redirect, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })

      if (authErr) {
        setError('E-mail ou senha incorretos. Verifique e tente novamente.')
        return
      }

      setSuccess(true)
      setTimeout(() => router.push(redirect), 3400)
    } catch (err) {
      console.error('[login]', err)
      setError('Erro de conexão. Tente novamente.')
    } finally {
      if (!success) setLoading(false)
    }
  }

  const TRUST_POINTS = [
    { icon: TrendingUp,   text: 'Seu negócio crescendo em autopiloto' },
    { icon: Zap,          text: 'IA trabalhando por você 24h' },
    { icon: Shield,       text: 'Seus dados com segurança total' },
    { icon: CheckCircle,  text: 'Resultados mensuráveis em dias' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[500px] w-[500px] rounded-full bg-violet-700/12 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }} />
      </div>

      <div className="relative z-10 flex min-h-screen">

        {/* ── Left panel ────────────────────────────────────────────── */}
        <div className="hidden flex-col justify-between p-12 lg:flex lg:w-[45%] xl:w-[40%]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-violet-400">N</span>EXUS
            </span>
          </Link>

          {/* Main message */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-800/50 bg-violet-950/50 px-4 py-1.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                <span className="text-xs font-medium text-violet-300">Sistema de crescimento ativo</span>
              </div>

              <h1 className="mb-4 text-4xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-5xl">
                Você está entrando no seu{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  sistema de crescimento
                </span>
              </h1>

              <p className="mb-10 max-w-sm text-lg leading-relaxed text-zinc-400">
                A IA já está pronta para analisar seus dados, identificar oportunidades e executar ações pelo seu negócio.
              </p>

              <ul className="space-y-4">
                {TRUST_POINTS.map((pt, i) => (
                  <motion.li key={pt.text}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3 text-sm text-zinc-400"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                      <pt.icon className="h-4 w-4 text-violet-400" />
                    </div>
                    {pt.text}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Bottom note */}
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} NEXUS — COO de IA para negócios
          </p>
        </div>

        {/* ── Right panel (form) ────────────────────────────────────── */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">

          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold"><span className="text-violet-400">N</span>EXUS</span>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <OnboardingScreen key="onboarding" onEnter={() => router.push(redirect)} />
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
              >
                {/* Top glow line */}
                <div className="pointer-events-none mb-8 h-px w-full bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white">Entrar na sua conta</h2>
                  <p className="mt-1.5 text-sm text-zinc-400">Continue de onde você parou</p>
                </div>

                {/* Email confirmed banner */}
                {confirmed && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/40 px-4 py-3"
                  >
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-300">E-mail confirmado! Faça login para acessar o NEXUS.</p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-red-300">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoFocus
                      className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-300">Senha</label>
                      <a href="#" className="text-xs text-zinc-500 transition hover:text-violet-400">Esqueci minha senha</a>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.25)] transition-all hover:bg-violet-500 hover:shadow-[0_0_32px_rgba(124,58,237,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Verificando…</>
                    ) : (
                      <>
                        Entrar no sistema
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/8 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  </button>
                </form>

                <div className="mt-6 flex flex-col items-center gap-4">
                  <div className="h-px w-full bg-zinc-800" />
                  <p className="text-sm text-zinc-500">
                    Não tem conta?{' '}
                    <Link href="/start" className="font-medium text-violet-400 transition hover:text-violet-300">
                      Criar conta gratuita
                    </Link>
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-zinc-700" />
                    Dados criptografados
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3 text-zinc-700" />
                    Sem compartilhamento
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
