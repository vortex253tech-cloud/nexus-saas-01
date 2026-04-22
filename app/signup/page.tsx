'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()

  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseClient()

      // 1. Create Supabase Auth account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
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

      console.log('[signup] AUTH USER:', authData.user.id, '| email:', email)

      // 2. Create user + company record
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          nomeEmpresa: empresa || 'Minha Empresa',
          perfil: 'outro',
          auth_id: authData.user.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('[signup] company creation failed:', err)
        // Non-critical — trigger may have created user row already
      } else {
        const json = await res.json()
        console.log('[signup] COMPANY CREATED:', json.company?.id)
      }

      // 3. Redirect to dashboard (middleware will verify session)
      router.push('/dashboard')
    } catch (err) {
      console.error('[signup]', err)
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-white">
            <span className="text-violet-500">N</span>EXUS
          </span>
          <p className="text-zinc-400 mt-2 text-sm">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-5">
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
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 text-sm"
          >
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>

          <p className="text-center text-zinc-500 text-xs">
            Já tem conta?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
