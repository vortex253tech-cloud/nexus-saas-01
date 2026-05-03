// POST /api/suppliers/analyze  — run AI analysis + persist insights

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { analyzeSuppliers, aiSupplierInsights, type Supplier } from '@/lib/suppliers-engine'

export async function POST() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Load suppliers with costs
  const { data: suppliers, error: supErr } = await db
    .from('suppliers')
    .select('*, costs:supplier_costs(*)')
    .eq('company_id', auth.companyId)

  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 })

  // Load latest revenue for context
  const { data: revRow } = await db
    .from('revenue_entries')
    .select('amount')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const totalMonthlyRevenue = revRow?.amount ?? 0

  // Load company name
  const { data: company } = await db
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .single()

  const typedSuppliers = (suppliers ?? []) as Supplier[]

  // Run analysis engine
  const analysis = analyzeSuppliers(typedSuppliers, totalMonthlyRevenue)

  // Get AI insights
  const aiInsights = await aiSupplierInsights({
    scored: analysis.scored,
    totalMonthlyCost: analysis.totalMonthlyCost,
    totalMonthlyRevenue,
    nomeEmpresa: company?.name ?? 'Empresa',
  })

  // Merge rule-based + AI insights (AI appended after rules)
  const allInsights = [...analysis.ruleInsights, ...aiInsights]

  // Persist insights — replace old ones for this company
  await db.from('supplier_insights').delete().eq('company_id', auth.companyId)

  if (allInsights.length > 0) {
    await db.from('supplier_insights').insert(
      allInsights.map(i => ({
        company_id:   auth.companyId,
        supplier_id:  i.supplier_id,
        type:         i.type,
        message:      i.message,
        impact_value: i.impact_value,
      }))
    )
  }

  return NextResponse.json({
    data: {
      totalMonthlyCost:   analysis.totalMonthlyCost,
      savingsOpportunity: analysis.savingsOpportunity,
      scored:             analysis.scored,
      topThree:           analysis.topThree,
      categoryBreakdown:  analysis.categoryBreakdown,
      insights:           allInsights,
    },
  })
}

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()

  // Return cached insights from last analysis run
  const { data: insights, error } = await db
    .from('supplier_insights')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('impact_value', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: insights ?? [] })
}
