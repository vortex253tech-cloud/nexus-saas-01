// ─── Business Identity Helper ─────────────────────────────────────────────────
// Server-side only. Loads and decrypts a company's white-label identity.
// Used by email/WhatsApp senders to pick the right From address and branding.

import { getSupabaseServerClient } from '@/lib/supabase'
import { decrypt } from '@/lib/payments/encryption'

export interface BusinessIdentity {
  id: string
  companyId: string
  // Company info
  companyName: string | null
  slogan: string | null
  website: string | null
  supportPhone: string | null
  // Branding
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  // Email sender
  senderName: string | null
  senderEmail: string | null
  supportEmail: string | null
  replyToEmail: string | null
  // SMTP
  smtpEnabled: boolean
  smtpHost: string | null
  smtpPort: number
  smtpUser: string | null
  smtpPassword: string | null   // decrypted
  smtpSecure: boolean
  // Resend
  resendApiKey: string | null   // decrypted
  resendFromDomain: string | null
  // WhatsApp
  whatsappNumber: string | null
  whatsappDisplayName: string | null
  // Z-API (per-company WhatsApp instance)
  zapiInstanceId: string | null
  zapiToken: string | null        // decrypted
  zapiClientToken: string | null
  // Domain verification
  domainVerified: boolean
  spfVerified: boolean
  dkimVerified: boolean
  dmarcVerified: boolean
  // Status
  customSenderEnabled: boolean
}

/** Returns the company's white-label identity, or null if none configured. */
export async function getBusinessIdentity(companyId: string): Promise<BusinessIdentity | null> {
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('business_identity')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (error || !data) return null

  const safe = data as Record<string, unknown>

  function tryDecrypt(field: string): string | null {
    const raw = safe[field]
    if (!raw || typeof raw !== 'string') return null
    try { return decrypt(raw) } catch { return null }
  }

  return {
    id:                  safe.id as string,
    companyId:           safe.company_id as string,
    companyName:         (safe.company_name as string | null) ?? null,
    slogan:              (safe.slogan as string | null) ?? null,
    website:             (safe.website as string | null) ?? null,
    supportPhone:        (safe.support_phone as string | null) ?? null,
    logoUrl:             (safe.logo_url as string | null) ?? null,
    primaryColor:        (safe.primary_color as string | null) ?? '#6366f1',
    secondaryColor:      (safe.secondary_color as string | null) ?? '#8b5cf6',
    senderName:          (safe.sender_name as string | null) ?? null,
    senderEmail:         (safe.sender_email as string | null) ?? null,
    supportEmail:        (safe.support_email as string | null) ?? null,
    replyToEmail:        (safe.reply_to_email as string | null) ?? null,
    smtpEnabled:         (safe.smtp_enabled as boolean | null) ?? false,
    smtpHost:            (safe.smtp_host as string | null) ?? null,
    smtpPort:            (safe.smtp_port as number | null) ?? 587,
    smtpUser:            (safe.smtp_user as string | null) ?? null,
    smtpPassword:        tryDecrypt('smtp_password_enc'),
    smtpSecure:          (safe.smtp_secure as boolean | null) ?? false,
    resendApiKey:        tryDecrypt('resend_api_key_enc'),
    resendFromDomain:    (safe.resend_from_domain as string | null) ?? null,
    whatsappNumber:      (safe.whatsapp_number as string | null) ?? null,
    whatsappDisplayName: (safe.whatsapp_display_name as string | null) ?? null,
    zapiInstanceId:      (safe.zapi_instance_id as string | null) ?? null,
    zapiToken:           tryDecrypt('zapi_token_enc'),
    zapiClientToken:     (safe.zapi_client_token as string | null) ?? null,
    domainVerified:      (safe.domain_verified as boolean | null) ?? false,
    spfVerified:         (safe.spf_verified as boolean | null) ?? false,
    dkimVerified:        (safe.dkim_verified as boolean | null) ?? false,
    dmarcVerified:       (safe.dmarc_verified as boolean | null) ?? false,
    customSenderEnabled: (safe.custom_sender_enabled as boolean | null) ?? false,
  }
}

/**
 * Reverse lookup: given a Z-API instance ID from an inbound webhook payload,
 * find which company owns it. Used by the WhatsApp webhook to route an
 * incoming message to the right tenant — the webhook itself carries no
 * session, so the instance ID is the only multi-tenant signal available.
 */
export async function getCompanyIdByZapiInstance(zapiInstanceId: string): Promise<string | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('business_identity')
    .select('company_id')
    .eq('zapi_instance_id', zapiInstanceId)
    .maybeSingle()

  return (data?.company_id as string | undefined) ?? null
}

/**
 * Returns the "From" string to use for outgoing emails.
 * Falls back to the platform-level RESEND_FROM env var.
 */
export function resolveEmailFrom(identity: BusinessIdentity | null): string {
  if (
    identity?.customSenderEnabled &&
    identity.senderName &&
    identity.senderEmail
  ) {
    return `${identity.senderName} <${identity.senderEmail}>`
  }
  return (process.env.RESEND_FROM ?? 'NEXUS <noreply@nexusaas.com.br>')
}
