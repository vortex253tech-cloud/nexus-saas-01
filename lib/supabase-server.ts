import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Server client for API routes / Server Components ─────────
// Reads + writes cookies automatically.
// Only import from server-side files (API routes, Server Components, middleware).
export async function getSupabaseRouteClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
}
