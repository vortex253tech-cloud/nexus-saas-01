import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

// ─── GET /api/tour ─────────────────────────────────────────────
// Returns the current user's onboarding progress.

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data } = await db
    .from('users')
    .select('onboarding_step, onboarding_completed')
    .eq('id', auth.user.id)
    .maybeSingle()

  return NextResponse.json({
    step:      (data as { onboarding_step?: number } | null)?.onboarding_step      ?? 0,
    completed: (data as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? false,
  })
}

// ─── POST /api/tour ────────────────────────────────────────────
// Persists onboarding step + completed flag.

export async function POST(req: Request) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body      = await req.json().catch(() => ({}))
  const step      = Number(body.step)      || 0
  const completed = Boolean(body.completed)

  const db = getSupabaseServerClient()
  await db
    .from('users')
    .update({ onboarding_step: step, onboarding_completed: completed } as object)
    .eq('id', auth.user.id)

  return NextResponse.json({ ok: true })
}
