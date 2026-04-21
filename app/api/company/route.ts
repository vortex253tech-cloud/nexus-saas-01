// GET/POST /api/company
// Finds or creates a user+company by email (no-auth demo mode).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import type { DBCompany, DBUser } from '@/lib/db'
import { getString, isRecord, readJsonObject } from '@/lib/unknown'

type UserWithCompanies = DBUser & { companies?: DBCompany[] | null }

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data: user, error } = await db
    .from('users')
    .select('*, companies(*)')
    .eq('email', email)
    .returns<UserWithCompanies[]>()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!user) return NextResponse.json({ exists: false })

  const company = Array.isArray(user.companies) ? user.companies[0] ?? null : null
  return NextResponse.json({ exists: true, user, company })
}

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req)
  const email = body ? getString(body, 'email') : undefined
  const name = body ? getString(body, 'name') : undefined
  const nomeEmpresa = body ? getString(body, 'nomeEmpresa') : undefined
  const perfil = body ? getString(body, 'perfil') : undefined
  const setor = body ? getString(body, 'setor') : undefined
  const quizData = body && isRecord(body.quizData) ? body.quizData : undefined

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data: user, error: userErr } = await db
    .from('users')
    .upsert({ email, name: name ?? null }, { onConflict: 'email' })
    .select()
    .returns<DBUser[]>()
    .single()

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  const { data: existingCompany } = await db
    .from('companies')
    .select()
    .eq('user_id', user.id)
    .returns<DBCompany[]>()
    .maybeSingle()

  let company = existingCompany
  if (!company) {
    const { data: newCompany, error: compErr } = await db
      .from('companies')
      .insert({
        user_id: user.id,
        name: nomeEmpresa ?? 'Minha Empresa',
        sector: setor ?? null,
        perfil: perfil ?? null,
      })
      .select()
      .returns<DBCompany[]>()
      .single()

    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })
    company = newCompany

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

    await db.from('subscriptions').insert({
      user_id: user.id,
      plan: 'free',
      status: 'trialing',
    })
  }

  return NextResponse.json({ user, company })
}
