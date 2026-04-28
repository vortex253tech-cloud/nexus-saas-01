import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await req.json() as { themeKey?: string }
    const { themeKey } = body
    if (!themeKey) {
      return NextResponse.json({ ok: false, error: 'themeKey required' }, { status: 400 })
    }

    // Fire-and-forget upsert — table may not exist yet, that's fine
    try {
      const { getSupabaseRouteClient } = await import('@/lib/supabase-server')
      const supabase = await getSupabaseRouteClient()
      await supabase
        .from('user_preferences')
        .upsert({ user_id: ctx.user.id, theme_key: themeKey, updated_at: new Date().toISOString() })
        .eq('user_id', ctx.user.id)
    } catch {
      // Table not provisioned yet — ignore silently
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // never error-out the client
  }
}
