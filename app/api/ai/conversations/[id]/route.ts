// GET /api/ai/conversations/[id] — load messages for a conversation

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: Context) {
  const { id } = await context.params

  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Verify conversation belongs to this company
  const { data: conv } = await db
    .from('nexus_ai_conversations')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('nexus_ai_messages')
    .select('id, role, content, action_card, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
