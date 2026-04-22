'use client'

// Resolves company_id for client components.
// 1. sessionStorage.nexus_resultado (set by onboarding or dashboard boot)
// 2. /api/auth/session (works when user logged in via /login without onboarding)
// Saves to sessionStorage so subsequent calls are instant.
export async function resolveCompanyId(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Fast path: already in sessionStorage
  try {
    const raw = sessionStorage.getItem('nexus_resultado')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const cid = parsed.company_id ?? parsed.companyId
      if (typeof cid === 'string' && cid) return cid
    }
  } catch { /* ignore */ }

  // Network path: ask the auth session endpoint
  try {
    const res = await fetch('/api/auth/session')
    if (res.ok) {
      const json = await res.json() as { authenticated?: boolean; companyId?: string }
      if (json.authenticated && json.companyId) {
        // Cache it so the next call is instant
        const existing = sessionStorage.getItem('nexus_resultado')
        const prev = existing ? (JSON.parse(existing) as Record<string, unknown>) : {}
        sessionStorage.setItem('nexus_resultado', JSON.stringify({ ...prev, company_id: json.companyId }))
        return json.companyId
      }
    }
  } catch { /* network error */ }

  return null
}
