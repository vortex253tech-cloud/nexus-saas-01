'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, CheckCircle2, RefreshCw, Loader2, ArrowLeft } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'

// ─── "Check your email" screen ────────────────────────────────

function CheckEmailScreen({ email, onResend, resending }: {
  email:     string
  onResend:  () => void
  resending: boolean
}) {
  return (
    <motion.div
      key="check-email"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="text-center space-y-6"
    >
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 ring-2 ring-violet-500/30">
          <Mail size={30} className="text-violet-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Verifique seu e-mail</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Enviamos um link de confirmação para<br />
          <span className="font-semibold text-white">{email}</span>
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-left space-y-2">
        {[
          'Abra seu e-mail',
          'Clique em "Confirmar minha conta"',
          'Você será redirecionado ao dashboard',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-zinc-400">
            <CheckCircle2 size={14} className="text-violet-400 mt-0.5 shrink-0" />
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

// ─── Main Page ─────────────────────────────────────────────────

export default function SignupPage() {
  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [sent,      setSent]      = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseClient()

      // 1. Create Supabase Auth account — email redirect points to production
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      })

      if (authErr) {
        setError(authErr.message === 'User already registered'
          ? 'E-mail já cadastrado. Faça login.'
          : authErr.message)
        return
      }

      if (!authData.user) {
        setError('Erro ao criar conta. Tente novamente.')
        return
      }

      // 2. Create user + company record (non-blocking)
      fetch('/api/company', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email,
          name,
          nomeEmpresa: empresa || 'Minha Empresa',
          perfil:      'outro',
          auth_id:     authData.user.id,
        }),
      }).catch(err => console.error('[signup] company creation:', err))

      // 3. Show "check your email" screen
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
        type:  'signup',
        email,
        options: { emailRedirectTo: `${appUrl}/auth/callback` },
      })
    } catch { /* silent — email may still be on the way */ }
    finally { setResending(false) }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-3xl font-bold text-white">
              <span className="text-violet-500">N</span>EXUS
            </span>
          </Link>
          <p className="text-zinc-400 mt-2 text-sm">
            {sent ? 'Quase lá!' : 'Crie sua conta gratuita'}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <AnimatePresence mode="wait">
            {sent ? (
              <CheckEmailScreen
                key="check"
                email={email}
                onResend={handleResend}
                resending={resending}
              />
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {error && (
                  <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Seu nome</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="João Silva"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Nome da empresa</label>
                  <input
                    type="text"
                    value={empresa}
                    onChange={e => setEmpresa(e.target.value)}
                    placeholder="Minha Empresa"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Criando conta…</>
                    : 'Criar conta grátis'
                  }
                </button>

                <p className="text-center text-zinc-500 text-xs">
                  Já tem conta?{' '}
                  <Link href="/login" className="text-violet-400 hover:text-violet-300">
                    Entrar
                  </Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
