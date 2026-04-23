import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Browser client (Client Components) ───────────────────────
// Singleton — one instance per browser tab prevents session desync.
// @supabase/ssr stores session in cookies (not localStorage/sessionStorage),
// so it persists across tabs, reloads, and browser restarts automatically.
let _browserClient: ReturnType<typeof createBrowserClient> | undefined

export function getSupabaseClient() {
  if (!_browserClient) {
    _browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return _browserClient
}

// ─── Server client for API routes (service role, no session) ─
export function getSupabaseServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}
