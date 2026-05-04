// GET  /api/ai/conversations  — list recent conversations with last message preview
// POST /api/ai/conversations  — create a new empty conversation

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Load last 10 conversations for this company
  const { data: convs, error } = await db
    .from('nexus_ai_conversations')
    .select('id, title, created_at, updated_at')
    .eq('company_id', auth.companyId)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!convs || convs.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // For each conversation, grab the last message for preview
  const ids = convs.map(c => c.id)

  const { data: lastMsgs } = await db
    .from('nexus_ai_messages')
    .select('conversation_id, role, content, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })

  // Build a map: conversation_id → last message
  const lastByConv: Record<string, { role: string; content: string }> = {}
  for (const msg of lastMsgs ?? []) {
    if (!lastByConv[msg.conversation_id]) {
      lastByConv[msg.conversation_id] = { role: msg.role, content: msg.content }
    }
  }

  const result = convs.map(c => ({
    id:          c.id,
    title:       c.title,
    created_at:  c.created_at,
    updated_at:  c.updated_at,
    last_message: lastByConv[c.id] ?? null,
  }))

  return NextResponse.json({ data: result })
}

export async function POST(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('nexus_ai_conversations')
    .insert({
      user_id:    auth.authId,
      company_id: auth.companyId,
      title:      'Nova conversa',
    })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
