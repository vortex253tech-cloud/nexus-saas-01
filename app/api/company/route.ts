// GET/POST /api/company
// Finds or creates a user+company linked to Supabase Auth.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import type { DBCompany, DBUser } from '@/lib/db'
import { getString, isRecord, readJsonObject } from '@/lib/unknown'

export const dynamic = 'force-dynamic'

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
  const body        = await readJsonObject(req)
  const email       = body ? getString(body, 'email')       : undefined
  const name        = body ? getString(body, 'name')        : undefined
  const nomeEmpresa = body ? getString(body, 'nomeEmpresa') : undefined
  const perfil      = body ? getString(body, 'perfil')      : undefined
  const setor       = body ? getString(body, 'setor')       : undefined
  const auth_id     = body ? getString(body, 'auth_id')     : undefined
  const quizData    = body && isRecord(body.quizData) ? body.quizData : undefined

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  console.log('[company] POST — email:', email, '| auth_id:', auth_id, '| empresa:', nomeEmpresa)

  const db = getSupabaseServerClient()

  // Upsert user row — link auth_id if provided
  const upsertData: Record<string, unknown> = { email, name: name ?? null }
  if (auth_id) upsertData.auth_id = auth_id

  const { data: user, error: userErr } = await db
    .from('users')
    .upsert(upsertData, { onConflict: 'email' })
    .select()
    .returns<DBUser[]>()
    .single()

  if (userErr) {
    console.error('[company] users upsert error:', userErr)
    return NextResponse.json({ error: userErr.message }, { status: 500 })
  }

  console.log('[company] USER ID:', user.id)

  // Update auth_id if not set
  if (auth_id && !(user as unknown as Record<string,unknown>).auth_id) {
    await db.from('users').update({ auth_id }).eq('id', user.id)
  }

  // Find existing company
  const { data: existingCompany } = await db
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .returns<DBCompany[]>()
    .maybeSingle()

  let company = existingCompany

  if (!company) {
    const { data: newCompany, error: compErr } = await db
      .from('companies')
      .insert({
        user_id:  user.id,
        name:     nomeEmpresa ?? 'Minha Empresa',
        sector:   setor   ?? null,
        perfil:   perfil  ?? null,
        email:    email,
      })
      .select()
      .returns<DBCompany[]>()
      .single()

    if (compErr) {
      console.error('[company] insert error:', compErr)
      return NextResponse.json({ error: compErr.message }, { status: 500 })
    }
    company = newCompany

    // Save quiz data
    if (quizData) {
      const quizInsert = await db.from('quiz_responses').insert({
        company_id:         company.id,
        perfil,
        nome_empresa:       nomeEmpresa,
        setor,
        meta_mensal:        quizData.metaMensal,
        principal_desafio:  quizData.principalDesafio,
        raw_data:           quizData,
      })
      if (quizInsert.error) console.error('[company] quiz_responses insert error:', quizInsert.error)
    }

    // Seed subscription
    const subInsert = await db.from('subscriptions').insert({
      user_id: user.id,
      plan:    'free',
      status:  'trialing',
    })
    if (subInsert.error) console.error('[company] subscriptions insert error:', subInsert.error)
  }

  console.log('[company] ✅ COMPANY ID:', company.id)
  return NextResponse.json({ user, company })
}
