// POST /api/flow-templates/[id]/rate — submit or update rating

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { rating?: number; comment?: string }

  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'Rating deve ser entre 1 e 5' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  // Upsert rating
  const { error: rateErr } = await db.from('flow_template_ratings').upsert({
    template_id: id,
    company_id:  ctx.company.id,
    rating:      body.rating,
    comment:     body.comment ?? null,
  }, { onConflict: 'template_id,company_id' })

  if (rateErr) return NextResponse.json({ error: rateErr.message }, { status: 500 })

  // Recalculate average
  const { data: agg } = await db
    .from('flow_template_ratings')
    .select('rating')
    .eq('template_id', id)

  if (agg) {
    const ratings = (agg as { rating: number }[]).map(r => r.rating)
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length
    await db.from('flow_templates').update({
      rating:       Math.round(avg * 10) / 10,
      rating_count: ratings.length,
    }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
