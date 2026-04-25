// GET  /api/messages/templates — list templates for company
// POST /api/messages/templates — create template

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('message_templates')
    .select('id, name, type, category, subject, content, is_default, created_at')
    .eq('company_id', ctx.company.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    name:     string
    type?:    'email' | 'whatsapp'
    category?: 'financial' | 'sales' | 'relationship' | 'custom'
    subject?: string
    content:  string
    is_default?: boolean
  }

  if (!body.name?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: 'Nome e conteúdo são obrigatórios' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('message_templates')
    .insert({
      company_id: ctx.company.id,
      name:       body.name.trim(),
      type:       body.type      ?? 'email',
      category:   body.category  ?? 'custom',
      subject:    body.subject   ?? '',
      content:    body.content.trim(),
      is_default: body.is_default ?? false,
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erro' }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
