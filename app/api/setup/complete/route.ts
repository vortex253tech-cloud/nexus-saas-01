import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function POST() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const db = getSupabaseServerClient()

    await db
      .from('users')
      .update({ onboarding_completed: true, onboarding_step: 7 })
      .eq('id', ctx.user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[setup/complete]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
