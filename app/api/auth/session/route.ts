import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await getAuthContext()

    if (!ctx) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: ctx.user.id,
        email: ctx.email,
        name: ctx.user.name,
        plan: ctx.user.plan,
        effectivePlan: ctx.effectivePlan,
      },
      company: {
        id: ctx.company.id,
        name: ctx.company.name,
        perfil: ctx.company.perfil,
        sector: ctx.company.sector,
        email: ctx.company.email,
        phone: ctx.company.phone,
      },
      companyId: ctx.companyId,
      subscription: ctx.subscription
        ? {
            status: ctx.subscription.status,
            plan: ctx.subscription.plan,
            trial_ends_at: ctx.subscription.trial_ends_at,
          }
        : null,
      trialDaysLeft: ctx.trialDaysLeft,
      isTrialActive: ctx.trialDaysLeft !== null && ctx.trialDaysLeft > 0,
    })
  } catch (err) {
    console.error('[auth/session]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
