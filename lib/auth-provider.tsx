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
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseClient()

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
