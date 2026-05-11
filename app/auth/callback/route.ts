// GET /auth/callback
// Supabase emails the user a link like:
//   https://nexusaas.com.br/auth/callback?code=xxx
// This route exchanges the one-time code for a real session, sets the
// cookie, then redirects to /dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code     = searchParams.get('code')
  const next     = searchParams.get('next') ?? null
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? origin

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=link_expired`)
  }

  try {
    const supabase = await getSupabaseRouteClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(`${appUrl}/login?error=confirmation_failed`)
    }

    // If a specific next param was provided, honour it
    if (next) {
      return NextResponse.redirect(`${appUrl}${next}`)
    }

    // Otherwise check whether the user has completed onboarding
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const db = getSupabaseServerClient()
      const { data: userRow } = await db
        .from('users')
        .select('onboarding_completed')
        .or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle()

      if (!userRow?.onboarding_completed) {
        return NextResponse.redirect(`${appUrl}/setup`)
      }
    }

    return NextResponse.redirect(`${appUrl}/dashboard`)
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=unexpected`)
  }
}
