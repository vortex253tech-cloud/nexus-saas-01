import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { company_id, name, email, phone, notes } = await req.json()

    if (!company_id || !name) {
      return NextResponse.json({ error: 'company_id e name são obrigatórios' }, { status: 400 })
    }

    const db = getSupabaseServerClient()

    const { data, error } = await db
      .from('customers')
      .insert({ company_id, name, email: email ?? null, phone: phone ?? null, notes: notes ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ customer: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
