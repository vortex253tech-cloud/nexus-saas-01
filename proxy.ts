import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS    = ['/', '/start', '/onboarding', '/resultado', '/planos']
const AUTH_PAGES      = ['/login', '/signup']           // logged-in users can't visit these
const PUBLIC_PREFIXES = [
  '/api/auth', '/api/leads', '/api/company', '/api/webhook',
  '/api/check-config', '/_next', '/favicon', '/auth',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through Next.js internals and static assets
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.includes('.')) return NextResponse.next()

  const isDashboard   = pathname.startsWith('/dashboard')
  const isAuthPage    = AUTH_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isProtectedApi = pathname.startsWith('/api/') &&
    !PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  // Fast path — public page, no auth check needed
  if (PUBLIC_PATHS.includes(pathname) && !isDashboard && !isProtectedApi) {
    return NextResponse.next()
  }

  // Build a cookie-aware client so tokens are refreshed on every edge request
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated → protect dashboard and API routes
  if (!user) {
    if (isDashboard) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return res
  }

  // Authenticated → bounce away from login / signup
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
