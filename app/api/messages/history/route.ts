// GET /api/messages/history — list message_logs for company

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '100'), 200)
  const status = searchParams.get('status')

  const db = getSupabaseServerClient()
  let query = db
    .from('message_logs')
    .select('id, client_name, channel, to_address, subject, status, sent_at, error_message')
    .eq('company_id', ctx.company.id)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}
