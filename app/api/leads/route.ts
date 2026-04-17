import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

// ─── POST /api/leads ──────────────────────────────────────────
// Upserts a lead by email. Called incrementally as the wizard
// progresses — each step merges answers into the existing record.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, perfil, respostas, fonte } = body

    if (!email && !nome) {
      return NextResponse.json(
        { error: 'email ou nome obrigatório' },
        { status: 400 },
      )
    }

    const supabase = getSupabaseServerClient()

    // If email provided, upsert. Otherwise insert.
    if (email) {
      // Load existing record to merge answers
      const { data: existing } = await supabase
        .from('onboarding_leads')
        .select('respostas')
        .eq('email', email)
        .maybeSingle()

      const mergedRespostas = {
        ...(existing?.respostas ?? {}),
        ...(respostas ?? {}),
      }

      const { data, error } = await supabase
        .from('onboarding_leads')
        .upsert(
          {
            email,
            nome: nome ?? null,
            perfil: perfil ?? null,
            respostas: mergedRespostas,
            fonte: fonte ?? 'direct',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email', ignoreDuplicates: false },
        )
        .select('id, email, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, lead: data })
    } else {
      // Anonymous lead (no email yet)
      const { data, error } = await supabase
        .from('onboarding_leads')
        .insert({
          nome: nome ?? null,
          perfil: perfil ?? null,
          respostas: respostas ?? {},
          fonte: fonte ?? 'direct',
        })
        .select('id, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, lead: data })
    }
  } catch (err) {
    console.error('[POST /api/leads]', err)
    return NextResponse.json(
      { error: 'Erro interno ao salvar lead' },
      { status: 500 },
    )
  }
}

// ─── GET /api/leads?email=X ───────────────────────────────────
// Fetch a specific lead (useful for resuming the wizard)

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('onboarding_leads')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error) throw error
  return NextResponse.json({ lead: data })
}
