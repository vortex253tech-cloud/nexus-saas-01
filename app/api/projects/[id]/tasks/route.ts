// GET  /api/projects/[id]/tasks  — list tasks for a project
// POST /api/projects/[id]/tasks  — create a task

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('project_tasks')
    .select('*')
    .eq('project_id', id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  const { data: project } = await db
    .from('projects')
    .select('company_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await db
    .from('project_tasks')
    .insert({
      project_id:    id,
      company_id:    project.company_id,
      title:         body.title.trim(),
      description:   body.description ?? null,
      status:        body.status        ?? 'todo',
      priority:      body.priority      ?? 'medium',
      due_date:      body.due_date      ?? null,
      assignee_name: body.assignee_name ?? null,
      tags:          body.tags          ?? [],
      position:      body.position      ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
