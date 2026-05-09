import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

async function resolveCompany(db: ReturnType<typeof getSupabaseServerClient>) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: u } = await db.from('users').select('id').eq('auth_id', user.id).single()
  if (!u) return null
  const { data: c } = await db.from('companies').select('*').eq('user_id', u.id).single()
  return c ?? null
}

// ─── GET ──────────────────────────────────────────────────────────
export async function GET() {
  const db = getSupabaseServerClient()
  const company = await resolveCompany(db)
  if (!company) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Also pull sender identity for the Communication section
  const { data: identity } = await db
    .from('business_identity')
    .select('sender_name,sender_email,support_email,reply_to_email,custom_sender_enabled')
    .eq('company_id', company.id)
    .maybeSingle()

  return NextResponse.json({ data: { ...company, identity: identity ?? null } })
}

// ─── POST ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const db = getSupabaseServerClient()
  const company = await resolveCompany(db)
  if (!company) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  // ── Companies row ──────────────────────────────────────────────
  const companyRow: Record<string, unknown> = {}
  const strings = [
    'name', 'fantasy_name', 'email', 'phone', 'sector',
    'slogan', 'description', 'website', 'instagram', 'whatsapp_commercial',
    'logo_url', 'banner_url', 'icon_url',
    'brand_name', 'brand_color',
    'ai_name', 'ai_role', 'ai_style',
    'niche', 'client_type', 'company_objective', 'communication_tone',
  ]
  for (const k of strings) {
    if (k in body) companyRow[k] = body[k] ?? null
  }

  if (Object.keys(companyRow).length > 0) {
    const { error: cErr } = await db
      .from('companies')
      .update(companyRow)
      .eq('id', company.id)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  }

  // ── business_identity (sender / communication) ─────────────────
  const identityFields = ['sender_name', 'sender_email', 'support_email', 'reply_to_email']
  const identityRow: Record<string, unknown> = { company_id: company.id }
  for (const k of identityFields) {
    if (k in body) identityRow[k] = body[k] ?? null
  }
  if ('custom_sender_enabled' in body) {
    identityRow.custom_sender_enabled = Boolean(body.custom_sender_enabled)
  }

  if (Object.keys(identityRow).length > 1) {
    const { error: iErr } = await db
      .from('business_identity')
      .upsert(identityRow, { onConflict: 'company_id' })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
