import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes accessible without authentication
const PUBLIC_PATHS = ['/', '/v1', '/start', '/onboarding', '/resultado', '/planos', '/setup']
const AUTH_PAGES   = ['/login', '/signup']

// Prefixes that always bypass the middleware
const PUBLIC_PREFIXES = [
  '/api/auth', '/api/leads', '/api/company', '/api/webhook', '/api/waitlist',
  '/api/check-config', '/_next', '/favicon', '/auth',
]

// ─── Domain → Landing Page mapping ───────────────────────────────────────
// Each domain serves a different landing page via internal rewrite.
// The URL the visitor sees never changes.
const DOMAIN_LANDING: Record<string, string> = {
  // New design (matches screenshots) — production domains
  'nexusaas.com.br':         '/',
  'www.nexusaas.com.br':     '/',
  // Old cinematic design — Vercel preview URL
  'nexus-saas-theta.vercel.app': '/v1',
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host') ?? ''

  // ── Domain-based landing page routing ───────────────────────────────────
  // Only applies to root path so /dashboard, /login etc. are unaffected
  if (pathname === '/') {
    const target = DOMAIN_LANDING[host]
    if (target && target !== '/') {
      const url = req.nextUrl.clone()
      url.pathname = target
      return NextResponse.rewrite(url)
    }
  }

  // Pass through Next.js internals and static assets
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.includes('.')) return NextResponse.next()

  const isDashboard    = pathname.startsWith('/dashboard')
  const isSetup        = pathname.startsWith('/setup')
  const isAuthPage     = AUTH_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isProtectedApi = pathname.startsWith('/api/') &&
    !PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  // Fast path — public page, no auth check needed
  if (PUBLIC_PATHS.includes(pathname) && !isDashboard && !isProtectedApi) {
    return NextResponse.next()
  }

  // Guard: if Supabase env vars are missing, pass through rather than crash
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    // Misconfigured environment — let the page handle it gracefully
    return NextResponse.next()
  }

  // Build a cookie-aware Supabase client to refresh tokens at the edge
  let res = NextResponse.next({ request: req })

  let user = null
  let authResolved = false
  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
            res = NextResponse.next({ request: req })
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options),
            )
          },
        },
      },
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
    authResolved = true
  } catch {
    // Supabase unreachable — pass through and let the page handle auth
    authResolved = false
  }

  // If we couldn't verify auth (edge Supabase failure), don't redirect
  // — prevents redirect loops when the browser client has a valid session
  if (!authResolved) return NextResponse.next()

  // ── Unauthenticated ──────────────────────────────────────────
  if (!user) {
    if (isDashboard || isSetup) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      if (isDashboard) loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return res
  }

  // ── Authenticated ────────────────────────────────────────────

  // Bounce away from login / signup
  if (isAuthPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search   = ''
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
