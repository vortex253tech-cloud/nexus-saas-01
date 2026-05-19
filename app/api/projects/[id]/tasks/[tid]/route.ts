// PATCH  /api/projects/[id]/tasks/[tid]  — update a task
// DELETE /api/projects/[id]/tasks/[tid]  — delete a task

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED = ['title', 'description', 'status', 'priority', 'due_date', 'assignee_name', 'tags', 'position'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('project_tasks')
    .update(updates)
    .eq('id', tid)
    .eq('project_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('project_tasks')
    .delete()
    .eq('id', tid)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
