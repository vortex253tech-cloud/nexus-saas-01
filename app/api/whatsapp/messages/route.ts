import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }          from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getMessages }             from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const companyId = ctx.companyId

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

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
