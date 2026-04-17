import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Browser client (for client components) ───────────────────
let _browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!_browserClient) {
    _browserClient = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _browserClient
}

// ─── Server client (for API routes) ───────────────────────────
// Uses service role key for full access (bypasses RLS)
export function getSupabaseServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}
