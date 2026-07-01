import { NextRequest, NextResponse }   from 'next/server'
import { getAuthContext }              from '@/lib/auth'
import { getConversations }            from '@/lib/whatsapp-engine'
import { getBusinessIdentity }         from '@/lib/business-identity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
    const limit  = 30

    // Resolve which company_id to query for WhatsApp conversations.
    // If the company has its own Z-API instance configured, use their company_id.
    // If not (they share the platform instance), conversations were stored under
    // NEXUS_PLATFORM_COMPANY_ID by the webhook — fall back to that so the
    // dashboard shows real data instead of empty rows.
    let companyId = ctx.companyId
    const identity = await getBusinessIdentity(companyId)
    const hasOwnInstance = !!(identity?.zapiInstanceId && identity.zapiToken)

    if (!hasOwnInstance) {
      const platformId = process.env.NEXUS_PLATFORM_COMPANY_ID
      if (platformId && platformId !== companyId) {
        companyId = platformId
      }
    }

    const conversations = await getConversations(companyId, limit + 1, cursor)
    const has_more      = conversations.length > limit
    const page          = has_more ? conversations.slice(0, limit) : conversations

    return NextResponse.json({ conversations: page, has_more })
  } catch (err) {
    console.error('[WA conversations] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
