import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/start', '/onboarding', '/resultado', '/planos', '/login', '/signup']
const PUBLIC_PREFIXES = ['/api/auth', '/api/leads', '/api/company', '/api/webhook', '/api/check-config', '/_next', '/favicon']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Only protect /dashboard and authenticated API routes
  const isDashboard = pathname.startsWith('/dashboard')
  const isProtectedApi = pathname.startsWith('/api/') &&
    !PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (!isDashboard && !isProtectedApi) return NextResponse.next()

  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Set all cookies on the request first, then create ONE new response
          // with all cookies — creating a response per cookie loses previous ones.
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated
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
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
