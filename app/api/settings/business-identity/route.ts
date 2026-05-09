import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { encrypt } from '@/lib/payments/encryption'

async function getCompanyId(db: ReturnType<typeof getSupabaseServerClient>): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: u } = await db.from('users').select('id').eq('auth_id', user.id).single()
  if (!u) return null
  const { data: c } = await db.from('companies').select('id').eq('user_id', u.id).single()
  return c?.id ?? null
}

// ─── GET — load current identity ──────────────────────────────
export async function GET() {
  const db = getSupabaseServerClient()
  const companyId = await getCompanyId(db)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('business_identity')
    .select(
      'id,company_name,slogan,website,support_phone,logo_url,primary_color,secondary_color,' +
      'sender_name,sender_email,support_email,reply_to_email,' +
      'smtp_enabled,smtp_host,smtp_port,smtp_user,smtp_secure,' +
      'resend_from_domain,whatsapp_number,whatsapp_display_name,' +
      'domain_verified,spf_verified,dkim_verified,dmarc_verified,custom_sender_enabled'
    )
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// ─── POST — upsert identity ───────────────────────────────────
export async function POST(req: NextRequest) {
  const db = getSupabaseServerClient()
  const companyId = await getCompanyId(db)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  const row: Record<string, unknown> = {
    company_id:           companyId,
    company_name:         body.companyName         ?? null,
    slogan:               body.slogan              ?? null,
    website:              body.website             ?? null,
    support_phone:        body.supportPhone        ?? null,
    logo_url:             body.logoUrl             ?? null,
    primary_color:        body.primaryColor        ?? '#6366f1',
    secondary_color:      body.secondaryColor      ?? '#8b5cf6',
    sender_name:          body.senderName          ?? null,
    sender_email:         body.senderEmail         ?? null,
    support_email:        body.supportEmail        ?? null,
    reply_to_email:       body.replyToEmail        ?? null,
    smtp_enabled:         body.smtpEnabled         ?? false,
    smtp_host:            body.smtpHost            ?? null,
    smtp_port:            body.smtpPort            ?? 587,
    smtp_user:            body.smtpUser            ?? null,
    smtp_secure:          body.smtpSecure          ?? false,
    resend_from_domain:   body.resendFromDomain    ?? null,
    whatsapp_number:      body.whatsappNumber      ?? null,
    whatsapp_display_name:body.whatsappDisplayName ?? null,
    zapi_instance_id:     body.zapiInstanceId      ?? null,
    zapi_client_token:    body.zapiClientToken      ?? null,
    custom_sender_enabled:body.customSenderEnabled ?? false,
  }

  if (typeof body.smtpPassword === 'string' && body.smtpPassword.trim()) {
    row.smtp_password_enc = encrypt(body.smtpPassword as string)
  }
  if (typeof body.resendApiKey === 'string' && body.resendApiKey.trim()) {
    row.resend_api_key_enc = encrypt(body.resendApiKey as string)
  }
  if (typeof body.zapiToken === 'string' && body.zapiToken.trim()) {
    row.zapi_token_enc = encrypt(body.zapiToken as string)
  }

  const { error } = await db
    .from('business_identity')
    .upsert(row, { onConflict: 'company_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
