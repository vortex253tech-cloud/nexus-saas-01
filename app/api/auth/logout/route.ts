import { NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await getSupabaseRouteClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/logout]', err)
    return NextResponse.json({ error: 'Erro ao sair' }, { status: 500 })
  }
}
