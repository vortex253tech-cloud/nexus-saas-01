'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from './supabase'

// ─── Context ───────────────────────────────────────────────────

interface AuthState {
  user:    User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user:    null,
  session: null,
  loading: true,
  signOut: async () => {},
})

// ─── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,       setUser]       = useState<User | null>(null)
  const [session,    setSession]    = useState<Session | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [configErr,  setConfigErr]  = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch (e) {
      setConfigErr(e instanceof Error ? e.message : 'Supabase não configurado')
      setLoading(false)
      return
    }

    // Restore session on mount (covers page reload + browser restart)
    void (async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })()

    // Keep state in sync with Supabase token lifecycle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (configErr) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, padding: '2rem', textAlign: 'center', border: '1px solid #3f3f46', borderRadius: 16, background: '#18181b' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
          <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Configuração necessária</h2>
          <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            As variáveis de ambiente do Supabase não estão configuradas no Vercel.
          </p>
          <div style={{ background: '#09090b', borderRadius: 8, padding: '1rem', textAlign: 'left', marginBottom: 16 }}>
            <p style={{ color: '#7c3aed', fontFamily: 'monospace', fontSize: 12, margin: '0 0 4px' }}>NEXT_PUBLIC_SUPABASE_URL</p>
            <p style={{ color: '#7c3aed', fontFamily: 'monospace', fontSize: 12, margin: 0 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
            <p style={{ color: '#7c3aed', fontFamily: 'monospace', fontSize: 12, margin: '4px 0 0' }}>SUPABASE_SERVICE_ROLE_KEY</p>
          </div>
          <p style={{ color: '#71717a', fontSize: 12 }}>
            Adicione em: <strong style={{ color: '#a1a1aa' }}>Vercel → Settings → Environment Variables</strong> e faça um novo deploy.
          </p>
        </div>
      </div>
    )
  }

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient()
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await supabase.auth.signOut()
    } catch { /* ok */ }
    sessionStorage.clear()
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext)
}
