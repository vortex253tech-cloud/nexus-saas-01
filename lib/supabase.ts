import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Browser client (Client Components) ───────────────────────
// Uses cookies — session persists across tabs and page reloads.
export function getSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// ─── Server client for API routes (service role, no session) ─
export function getSupabaseServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}
