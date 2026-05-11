import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json() as {
      companyName?: string
      segment?: string
      teamSize?: string
      objectives?: string[]
      mainChallenge?: string
      aiPersonality?: string
    }

    const db = getSupabaseServerClient()

    // Update company name + sector if provided
    if (body.companyName || body.segment) {
      await db
        .from('companies')
        .update({
          ...(body.companyName && { name: body.companyName }),
          ...(body.segment && { sector: body.segment }),
        })
        .eq('id', ctx.companyId)
    }

    // Upsert extended profile
    await db
      .from('company_profile')
      .upsert(
        {
          company_id: ctx.companyId,
          objectives: body.objectives ?? [],
          main_challenge: body.mainChallenge ?? null,
          team_size: body.teamSize ?? null,
          ai_personality: body.aiPersonality ?? 'moderno',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' },
      )

    // Track onboarding step on user
    await db
      .from('users')
      .update({ onboarding_step: 2 })
      .eq('id', ctx.user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[setup/profile]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
