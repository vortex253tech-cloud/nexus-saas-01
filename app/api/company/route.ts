// GET/POST /api/company
// Finds or creates a user+company by email (no-auth demo mode).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import type { DBUser, DBCompany } from '@/lib/db'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data: user, error } = await db
    .from('users')
    .select('*, companies(*)')
    .eq('email', email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!user) return NextResponse.json({ exists: false })

  return NextResponse.json({ exists: true, user, company: user.companies?.[0] ?? null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, name, nomeEmpresa, perfil, setor, quizData } = body as {
    email: string
    name?: string
    nomeEmpresa?: string
    perfil?: string
    setor?: string
    quizData?: Record<string, unknown>
  }

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = getSupabaseServerClient()

  // Upsert user
  const { data: user, error: userErr } = await db
    .from('users')
    .upsert({ email, name: name ?? null }, { onConflict: 'email' })
    .select()
    .single()

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  // Find existing company or create
  const { data: existingCompany } = await db
    .from('companies')
    .select()
    .eq('user_id', user.id)
    .maybeSingle()

  let company: DBCompany
  if (existingCompany) {
    company = existingCompany as DBCompany
  } else {
    const { data: newCompany, error: compErr } = await db
      .from('companies')
      .insert({
        user_id: user.id,
        name: nomeEmpresa ?? 'Minha Empresa',
        sector: setor ?? null,
        perfil: perfil ?? null,
      })
      .select()
      .single()

    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })
    company = newCompany as DBCompany

    // Store quiz response
    if (quizData) {
      await db.from('quiz_responses').insert({
        company_id: company.id,
        perfil,
        nome_empresa: nomeEmpresa,
        setor,
        meta_mensal: quizData.metaMensal,
        principal_desafio: quizData.principalDesafio,
        raw_data: quizData,
      })
    }

    // Create trial subscription
    await db.from('subscriptions').insert({
      user_id: user.id,
      plan: 'free',
      status: 'trialing',
    })
  }

  return NextResponse.json({ user, company })
}
