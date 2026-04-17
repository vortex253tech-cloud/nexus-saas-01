// GET /api/execution-history?company_id=
// Returns execution history ordered by most recent first.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('execution_history')
    .select('id, titulo, execution_type, ganho_realizado, execution_log, executed_at')
    .eq('company_id', company_id)
    .order('executed_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
