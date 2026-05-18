import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getMessages }             from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = await getSupabaseRouteClient()
    const { data: { user }, error } = await supabaseAuth.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    // Resolve authorised company_id (same logic as conversations route)
    let companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

    if (!companyId) {
      const { data: userRow } = await db
        .from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!userRow) return NextResponse.json({ messages: [] })

      const { data: company } = await db
        .from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
      if (!company) return NextResponse.json({ messages: [] })

      companyId = company.id
    }

    // Verify the conversation belongs to this company
    const { data: conversation } = await db
      .from('whatsapp_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!conversation) {
      console.warn('[WA messages] Conversation not found or wrong company:', conversationId, companyId)
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)
    const messages = await getMessages(conversationId, limit)
    console.log('[WA messages] found:', messages.length, 'for conv:', conversationId)
    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[WA messages] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
