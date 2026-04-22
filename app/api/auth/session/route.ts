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
    })
  } catch (err) {
    console.error('[auth/session]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
