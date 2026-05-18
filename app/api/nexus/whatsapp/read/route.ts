// POST /api/nexus/whatsapp/read — Reset unread_count for a conversation
// Called when the user opens a conversation in the UI.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 5

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { conversation_id?: string }
    if (!body.conversation_id) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
    }

    await db().rpc('wa_mark_read', { p_conv_id: body.conversation_id })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
