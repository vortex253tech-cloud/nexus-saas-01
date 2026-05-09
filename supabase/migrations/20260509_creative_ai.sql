-- ─── NEXUS Creative AI Engine — Database Schema ─────────────────────────────
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. company_identity ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_identity (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fantasy_name   text        NOT NULL DEFAULT '',
  slogan         text        NULL,
  ai_name        text        NOT NULL DEFAULT 'Assistente',
  ai_role        text        NOT NULL DEFAULT 'Assistente de atendimento',
  ai_style       text        NOT NULL DEFAULT 'amigavel',
  niche          text        NULL,
  primary_color  text        NULL,
  logo_url       text        NULL,
  website        text        NULL,
  instagram      text        NULL,
  whatsapp       text        NULL,
  tone_keywords  text[]      NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_identity_company ON company_identity(company_id);

ALTER TABLE company_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own identity" ON company_identity;
CREATE POLICY "company members can access own identity"
  ON company_identity FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 2. creative_templates ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creative_templates (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  type         text        NOT NULL,   -- 'image' | 'whatsapp' | 'email' | 'instagram' | 'pdf' | 'landing'
  category     text        NOT NULL,   -- 'cobranca' | 'promocao' | 'reativacao' | 'vendas' | 'boas_vindas'
  content      jsonb       NOT NULL DEFAULT '{}',
  thumbnail_url text       NULL,
  is_favorite  boolean     NOT NULL DEFAULT false,
  usage_count  int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_templates_company  ON creative_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_creative_templates_type     ON creative_templates(company_id, type);
CREATE INDEX IF NOT EXISTS idx_creative_templates_category ON creative_templates(company_id, category);

ALTER TABLE creative_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own templates" ON creative_templates;
CREATE POLICY "company members can access own templates"
  ON creative_templates FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 3. ai_generated_assets ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_generated_assets (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id     uuid        REFERENCES creative_templates(id) ON DELETE SET NULL,
  type            text        NOT NULL,   -- 'image' | 'text' | 'html' | 'pdf'
  subtype         text        NULL,       -- 'banner' | 'post' | 'story' | 'email_body' | etc.
  prompt          text        NULL,
  content         text        NULL,       -- generated text or HTML
  image_url       text        NULL,       -- for image assets
  storage_path    text        NULL,
  model_used      text        NULL,
  generation_ms   int         NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_company  ON ai_generated_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_type     ON ai_generated_assets(company_id, type);
CREATE INDEX IF NOT EXISTS idx_assets_created  ON ai_generated_assets(created_at DESC);

ALTER TABLE ai_generated_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own assets" ON ai_generated_assets;
CREATE POLICY "company members can access own assets"
  ON ai_generated_assets FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 4. campaign_history ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_history (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  type            text        NOT NULL,   -- 'whatsapp' | 'email' | 'instagram' | 'mixed'
  status          text        NOT NULL DEFAULT 'draft',  -- 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  objective       text        NULL,       -- 'cobranca' | 'reativacao' | 'lancamento' | 'promocao'
  audience_filter jsonb       NOT NULL DEFAULT '{}',
  assets          jsonb       NOT NULL DEFAULT '[]',
  schedule_at     timestamptz NULL,
  sent_at         timestamptz NULL,
  recipient_count int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_company  ON campaign_history(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_status   ON campaign_history(company_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_created  ON campaign_history(created_at DESC);

ALTER TABLE campaign_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own campaigns" ON campaign_history;
CREATE POLICY "company members can access own campaigns"
  ON campaign_history FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 5. campaign_analytics ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id     uuid        NOT NULL REFERENCES campaign_history(id) ON DELETE CASCADE,
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent            int         NOT NULL DEFAULT 0,
  delivered       int         NOT NULL DEFAULT 0,
  opened          int         NOT NULL DEFAULT 0,
  clicked         int         NOT NULL DEFAULT 0,
  converted       int         NOT NULL DEFAULT 0,
  revenue_recovered numeric(12,2) NOT NULL DEFAULT 0,
  unsubscribed    int         NOT NULL DEFAULT 0,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_company  ON campaign_analytics(company_id);

ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own analytics" ON campaign_analytics;
CREATE POLICY "company members can access own analytics"
  ON campaign_analytics FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 6. ai_creative_logs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_creative_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id    uuid        REFERENCES ai_generated_assets(id) ON DELETE SET NULL,
  action      text        NOT NULL,   -- 'generate' | 'export' | 'send' | 'schedule'
  details     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_logs_company ON ai_creative_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_creative_logs_created ON ai_creative_logs(created_at DESC);

ALTER TABLE ai_creative_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own creative logs" ON ai_creative_logs;
CREATE POLICY "company members can access own creative logs"
  ON ai_creative_logs FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 7. Storage bucket: brand-assets ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets', 'brand-assets', false, 10485760,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ── 8. Storage bucket: creative-exports ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creative-exports', 'creative-exports', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf','text/html','application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- ── 9. Storage RLS ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated can upload brand-assets"  ON storage.objects;
DROP POLICY IF EXISTS "authenticated can read brand-assets"    ON storage.objects;
DROP POLICY IF EXISTS "authenticated can upload creative-exports" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can read creative-exports"   ON storage.objects;

CREATE POLICY "authenticated can upload brand-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "authenticated can read brand-assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brand-assets');

CREATE POLICY "authenticated can upload creative-exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'creative-exports');

CREATE POLICY "authenticated can read creative-exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'creative-exports');
