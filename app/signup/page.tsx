'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Mail, CheckCircle2, RefreshCw, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ─── "Check your email" screen ────────────────────────────────────────────────

function CheckEmailScreen({
  email,
  onResend,
  resending,
}: {
  email: string
  onResend: () => void
  resending: boolean
}) {
  return (
    <motion.div
      key="check-email"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 text-center"
    >
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 ring-2 ring-violet-500/30">
          <Mail size={30} className="text-violet-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Verifique seu e-mail</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Enviamos um link de confirmação para
          <br />
          <span className="font-semibold text-white">{email}</span>
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-left">
        {[
          'Abra seu e-mail',
          'Clique em "Confirmar minha conta"',
          'Você será redirecionado ao dashboard',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-zinc-400">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-violet-400" />
            {step}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={onResend}
          disabled={resending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending
            ? <><Loader2 size={14} className="animate-spin" /> Reenviando…</>
            : <><RefreshCw size={14} /> Reenviar e-mail</>
          }
        </button>
        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-zinc-600 transition hover:text-zinc-400"
        >
          <ArrowLeft size={12} /> Voltar para o login
        </Link>
      </div>

      <p className="text-xs text-zinc-600">
        Não recebeu? Verifique a pasta de spam ou aguarde alguns minutos.
      </p>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()

  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [sent,      setSent]      = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const busy   = loading || googleLoading

  // ── Google signup ───────────────────────────────────────────────────────────
  async function handleGoogleSignup() {
    setError(null)
    setGoogleLoading(true)
    try {
      const supabase = getSupabaseClient()
      const origin   = typeof window !== 'undefined' ? window.location.origin : appUrl
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${appUrl || origin}/auth/callback` },
      })
      if (oauthErr) {
        setError('Não foi possível entrar com Google. Tente novamente.')
        setGoogleLoading(false)
      }
    } catch {
      setError('Erro ao conectar com Google.')
      setGoogleLoading(false)
    }
  }

  // ── Email / Password signup ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseClient()

      // 1. Create the account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      })

      if (authErr) {
        if (
          authErr.message.toLowerCase().includes('rate limit') ||
          authErr.message.toLowerCase().includes('too many')
        ) {
          setError('Muitas tentativas detectadas. Aguarde alguns segundos e tente novamente.')
        } else if (authErr.message === 'User already registered') {
          setError('E-mail já cadastrado. Faça login.')
        } else {
          setError(authErr.message)
        }
        return
      }

      if (!authData.user) {
        setError('Erro ao criar conta. Tente novamente.')
        return
      }

      // 2. Non-blocking: create company record
      fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          nomeEmpresa: empresa || 'Minha Empresa',
          perfil:      'outro',
          auth_id:     authData.user.id,
        }),
      }).catch(err => console.error('[signup] company creation:', err))

      // 3. If Supabase returned a session immediately (email confirm disabled) → go to dashboard
      if (authData.session) {
        router.replace('/dashboard')
        return
      }

      // 4. Try signing in right away — works when email confirmation is disabled at project level
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (!signInErr && signInData.session) {
        router.replace('/dashboard')
        return
      }

      // 5. Email confirmation required — show verify screen
      setSent(true)
    } catch (err) {
      console.error('[signup]', err)
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${appUrl}/auth/callback` },
      })
    } catch { /* silent */ } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[500px] w-[500px] rounded-full bg-violet-700/10 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[80px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-violet-400">N</span>EXUS
              </span>
            </Link>
            <p className="mt-2 text-sm text-zinc-400">
              {sent ? 'Quase lá!' : 'Crie sua conta gratuita'}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <AnimatePresence mode="wait">
              {sent ? (
                <CheckEmailScreen
                  key="check"
                  email={email}
                  onResend={handleResend}
                  resending={resending}
                />
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  {/* Error banner */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* Google button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignup}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-medium text-white transition hover:border-zinc-600 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {googleLoading
                      ? <Loader2 size={16} className="animate-spin" />
                      : <GoogleIcon className="h-4 w-4 shrink-0" />
                    }
                    {googleLoading ? 'Conectando…' : 'Criar conta com Google'}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-xs text-zinc-600">ou com e-mail</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">Seu nome</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="João Silva"
                        disabled={busy}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">Nome da empresa</label>
                      <input
                        type="text"
                        value={empresa}
                        onChange={e => setEmpresa(e.target.value)}
                        placeholder="Minha Empresa"
                        disabled={busy}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">E-mail</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        disabled={busy}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">Senha</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="mínimo 6 caracteres"
                        disabled={busy}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.25)] transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Criando conta…</>
                        : 'Criar conta grátis'
                      }
                    </button>
                  </form>

                  <p className="text-center text-xs text-zinc-500">
                    Já tem conta?{' '}
                    <Link href="/login" className="text-violet-400 transition hover:text-violet-300">
                      Entrar
                    </Link>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
