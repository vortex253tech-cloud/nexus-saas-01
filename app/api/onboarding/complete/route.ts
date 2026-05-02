// POST /api/onboarding/complete
// Marks the current company's onboarding as completed.

import { NextResponse }           from 'next/server'
import { getAuthContext }         from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Best-effort — column may not exist yet if migration is pending.
  // We always return { ok: true } so the onboarding redirect is never blocked.
  try {
    await db
      .from('companies')
      .update({
        onboarding_completed:    true,
        onboarding_completed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', ctx.companyId)
  } catch {
    // Ignore — migration may be pending
  }

  return NextResponse.json({ ok: true })
}
