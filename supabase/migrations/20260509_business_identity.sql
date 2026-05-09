-- ─── Business Identity (White-Label Communication) ──────────────────────────
-- Each company can configure their own sender identity so all outgoing
-- emails and WhatsApp messages appear to come from THEIR brand, not Nexus.
-- Encrypted fields use AES-256-GCM (same key as user_payment_config).

CREATE TABLE IF NOT EXISTS business_identity (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- ── Company info ─────────────────────────────────────────────────────────
  company_name           text,
  slogan                 text,
  website                text,
  support_phone          text,

  -- ── Branding ─────────────────────────────────────────────────────────────
  logo_url               text,
  primary_color          text        DEFAULT '#6366f1',
  secondary_color        text        DEFAULT '#8b5cf6',

  -- ── Email sender identity ─────────────────────────────────────────────────
  sender_name            text,
  sender_email           text,
  support_email          text,
  reply_to_email         text,

  -- ── SMTP (custom sending) ─────────────────────────────────────────────────
  smtp_enabled           boolean     DEFAULT false,
  smtp_host              text,
  smtp_port              integer     DEFAULT 587,
  smtp_user              text,
  smtp_password_enc      text,        -- AES-256-GCM encrypted
  smtp_secure            boolean     DEFAULT false,

  -- ── Resend custom domain / API key ───────────────────────────────────────
  resend_api_key_enc     text,        -- AES-256-GCM encrypted
  resend_from_domain     text,

  -- ── WhatsApp business identity ────────────────────────────────────────────
  whatsapp_number        text,
  whatsapp_display_name  text,

  -- ── Domain verification status ───────────────────────────────────────────
  domain_verified        boolean     DEFAULT false,
  domain_verified_at     timestamptz,
  spf_verified           boolean     DEFAULT false,
  dkim_verified          boolean     DEFAULT false,
  dmarc_verified         boolean     DEFAULT false,

  -- ── Status ───────────────────────────────────────────────────────────────
  custom_sender_enabled  boolean     DEFAULT false,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS business_identity_company_id_idx ON business_identity (company_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_business_identity_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_identity_set_updated_at ON business_identity;
CREATE TRIGGER business_identity_set_updated_at
  BEFORE UPDATE ON business_identity
  FOR EACH ROW EXECUTE FUNCTION set_business_identity_updated_at();

-- RLS
ALTER TABLE business_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bi_service_role_all"      ON business_identity;
DROP POLICY IF EXISTS "bi_authenticated_company" ON business_identity;

CREATE POLICY "bi_service_role_all"
  ON business_identity FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "bi_authenticated_company"
  ON business_identity FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
  );
