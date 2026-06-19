import { NextRequest, NextResponse }   from 'next/server'
import { getAuthContext }              from '@/lib/auth'
import { getConversations }            from '@/lib/whatsapp-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const companyId = ctx.companyId

    const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
    const limit  = 30

    const conversations = await getConversations(companyId, limit + 1, cursor)
    const has_more      = conversations.length > limit
    const page          = has_more ? conversations.slice(0, limit) : conversations

    return NextResponse.json({ conversations: page, has_more })
  } catch (err) {
    console.error('[WA conversations] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
