// GET /api/core/migrate — returns migration status and instructions

import { NextResponse }        from 'next/server'
import { getAuthContext }      from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  // Check if nexus_events table exists
  const { error } = await supabase
    .from('nexus_events')
    .select('id', { count: 'exact', head: true })
    .limit(1)

  const tableExists = !error

  return NextResponse.json({
    nexus_events_table: tableExists ? 'exists' : 'missing',
    instructions: tableExists
      ? 'All migrations applied.'
      : 'Run the SQL from supabase/migrations/20260519_nexus_events.sql in the Supabase Dashboard > SQL Editor.',
    sql_file: 'supabase/migrations/20260519_nexus_events.sql',
  })
}
