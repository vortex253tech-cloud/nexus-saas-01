// GET /auth/callback
// Supabase emails the user a link like:
//   https://nexus-saas-theta.vercel.app/auth/callback?code=xxx
// This route exchanges the one-time code for a real session, sets the
// cookie, then redirects to /dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code     = searchParams.get('code')
  const next     = searchParams.get('next') ?? '/dashboard'
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? origin

  if (!code) {
    // No code → something went wrong (link expired or already used)
    return NextResponse.redirect(`${appUrl}/login?error=link_expired`)
  }

  try {
    const supabase = await getSupabaseRouteClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(`${appUrl}/login?error=confirmation_failed`)
    }

    // Session cookie set — send the user directly into the app
    return NextResponse.redirect(`${appUrl}${next}`)
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=unexpected`)
  }
}
