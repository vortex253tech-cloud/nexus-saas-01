// GET   /api/flow-templates/[id]  — get template detail (nodes + edges)
// PATCH /api/flow-templates/[id]  — update template (own templates only)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('flow_templates')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  // Bump usage count (fire-and-forget)
  void db.from('flow_templates').update({ usage_count: (data as { usage_count: number }).usage_count + 1 }).eq('id', id)

  return NextResponse.json({ template: data })
}
