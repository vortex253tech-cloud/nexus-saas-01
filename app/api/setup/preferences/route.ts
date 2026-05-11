import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { aiPersonality, integrations } = await req.json() as {
      aiPersonality?: string
      integrations?: string[]
    }

    const db = getSupabaseServerClient()

    // Update AI personality in profile
    if (aiPersonality) {
      await db
        .from('company_profile')
        .upsert(
          { company_id: ctx.companyId, ai_personality: aiPersonality, updated_at: new Date().toISOString() },
          { onConflict: 'company_id' },
        )
    }

    // Upsert integration preferences
    if (integrations && integrations.length > 0) {
      const rows = integrations.map((provider) => ({
        company_id: ctx.companyId,
        provider,
        status: 'pending' as const,
      }))

      for (const row of rows) {
        await db
          .from('company_integrations')
          .upsert(row, { onConflict: 'company_id,provider' })
      }
    }

    // Track step
    await db
      .from('users')
      .update({ onboarding_step: 4 })
      .eq('id', ctx.user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[setup/preferences]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
