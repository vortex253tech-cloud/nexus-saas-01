// POST /api/collections/charge-email — charge a single client via email only

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { chargeClientByEmail, type CollectionClient, type CollectionCompany } from '@/lib/collections'
import { getString } from '@/lib/unknown'

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body     = await req.json() as { client_id?: string }
  const clientId = getString(body as Record<string, unknown>, 'client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const db = getSupabaseServerClient()

  const { data: client, error } = await db
    .from('clients')
    .select('id, name, phone, email, total_revenue, due_date, status')
    .eq('id', clientId)
    .eq('company_id', ctx.company.id)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  if (!client.email) {
    return NextResponse.json({ error: 'Cliente sem email cadastrado' }, { status: 422 })
  }

  const { data: company } = await db
    .from('companies')
    .select('id, nome')
    .eq('id', ctx.company.id)
    .single()

  const companyInfo: CollectionCompany = {
    id:   ctx.company.id,
    nome: (company as { nome?: string } | null)?.nome ?? 'Empresa',
  }

  const result = await chargeClientByEmail(client as CollectionClient, companyInfo)

  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
