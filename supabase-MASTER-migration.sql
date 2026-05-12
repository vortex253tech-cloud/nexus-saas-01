-- ═══════════════════════════════════════════════════════════════════
-- NEXUS SaaS — MASTER MIGRATION (seguro rodar múltiplas vezes)
-- Cole tudo no Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- ─── Extensões ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Função updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- 1. TABELA users
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id                 UUID        UNIQUE,
  email                   TEXT        NOT NULL UNIQUE,
  name                    TEXT,
  plan                    TEXT        NOT NULL DEFAULT 'free',
  onboarding_step         INTEGER     NOT NULL DEFAULT 0,
  onboarding_completed    BOOLEAN     NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns that may be missing from older deployments
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id                 UUID UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. TABELA companies
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  sector      TEXT,
  perfil      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns that may be missing
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id            UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS perfil             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS principal_desafio  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_mensal        NUMERIC DEFAULT 50000;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ganho_acumulado    NUMERIC DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS autopilot_enabled  BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS score_before       INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS score_after        INTEGER;
-- Branding / white-label
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url           TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_name         TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color        TEXT DEFAULT '#6366f1';
-- Extended company profile
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fantasy_name       TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slogan             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description        TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website            TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram          TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_commercial TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS banner_url         TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS icon_url           TEXT;
-- AI identity
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_name            TEXT DEFAULT 'NEXUS IA';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_role            TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_style           TEXT DEFAULT 'profissional';
-- Personalisation
ALTER TABLE companies ADD COLUMN IF NOT EXISTS niche              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS client_type        TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_objective  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS communication_tone TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_email   ON companies(email)   WHERE email IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. TABELA subscriptions
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                   TEXT        NOT NULL DEFAULT 'free',
  status                 TEXT        NOT NULL DEFAULT 'trialing',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. TABELA company_profile (dados de onboarding)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS company_profile (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  objectives      TEXT[]      DEFAULT '{}',
  main_challenge  TEXT,
  team_size       TEXT,
  revenue_range   TEXT,
  ai_personality  TEXT        DEFAULT 'moderno',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS company_profile_company_id_key ON company_profile(company_id);

-- ═══════════════════════════════════════════════════════════════════
-- 5. TABELA ai_training_files
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_training_files (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  size         BIGINT,
  mime_type    TEXT,
  storage_path TEXT,
  status       TEXT        DEFAULT 'uploaded',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_training_files_company ON ai_training_files(company_id);

-- ═══════════════════════════════════════════════════════════════════
-- 6. TABELA company_integrations
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS company_integrations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider     TEXT        NOT NULL,
  status       TEXT        DEFAULT 'pending',
  config       JSONB       DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, provider)
);

-- ═══════════════════════════════════════════════════════════════════
-- 7. TABELA business_identity
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_identity (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  company_name           TEXT,
  slogan                 TEXT,
  website                TEXT,
  support_phone          TEXT,
  logo_url               TEXT,
  primary_color          TEXT        DEFAULT '#6366f1',
  secondary_color        TEXT        DEFAULT '#8b5cf6',
  sender_name            TEXT,
  sender_email           TEXT,
  support_email          TEXT,
  reply_to_email         TEXT,
  smtp_enabled           BOOLEAN     DEFAULT false,
  smtp_host              TEXT,
  smtp_port              INTEGER     DEFAULT 587,
  smtp_username          TEXT,
  smtp_password_enc      TEXT,
  custom_sender_enabled  BOOLEAN     DEFAULT false,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 8. TABELA quiz_responses (opcional — usada pelo onboarding antigo)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quiz_responses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID        REFERENCES companies(id) ON DELETE CASCADE,
  perfil             TEXT,
  nome_empresa       TEXT,
  setor              TEXT,
  meta_mensal        NUMERIC,
  principal_desafio  TEXT,
  raw_data           JSONB,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 9. TABELA financial_data
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS financial_data (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revenue       NUMERIC     NOT NULL DEFAULT 0,
  costs         NUMERIC     NOT NULL DEFAULT 0,
  profit        NUMERIC     NOT NULL DEFAULT 0,
  period_label  TEXT        NOT NULL DEFAULT '',
  period_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 10. TABELA diagnostics
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS diagnostics (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score                INTEGER,
  resumo               TEXT,
  ganho_total_estimado NUMERIC,
  benchmark_label      TEXT,
  ai_summary           TEXT,
  raw_data             JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 11. TRIGGERS updated_at
-- ═══════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_users_updated_at        ON users;
DROP TRIGGER IF EXISTS trg_companies_updated_at    ON companies;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 12. TRIGGER: Supabase Auth → users (sincronização automática)
-- Cria/atualiza a linha em users quando um usuário se cadastra no Supabase
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, auth_id, email, name, plan, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_id    = NEW.id,
        name       = COALESCE(EXCLUDED.name, users.name),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════
-- 13. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses    ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies
DROP POLICY IF EXISTS "service_full_users"             ON users;
DROP POLICY IF EXISTS "service_full_companies"         ON companies;
DROP POLICY IF EXISTS "service_full_subscriptions"     ON subscriptions;
DROP POLICY IF EXISTS "service_full_company_profile"   ON company_profile;
DROP POLICY IF EXISTS "service_full_ai_training"       ON ai_training_files;
DROP POLICY IF EXISTS "service_full_integrations"      ON company_integrations;
DROP POLICY IF EXISTS "service_full_business_identity" ON business_identity;
DROP POLICY IF EXISTS "service_full_financial"         ON financial_data;
DROP POLICY IF EXISTS "service_full_diagnostics"       ON diagnostics;
DROP POLICY IF EXISTS "service_full_quiz"              ON quiz_responses;

-- Service role has full access to all tables (API routes use service role key)
CREATE POLICY "service_full_users"             ON users             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_companies"         ON companies         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_subscriptions"     ON subscriptions     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_company_profile"   ON company_profile   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_ai_training"       ON ai_training_files FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_integrations"      ON company_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_business_identity" ON business_identity FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_financial"         ON financial_data    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_diagnostics"       ON diagnostics       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_quiz"              ON quiz_responses     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 14. STORAGE BUCKET para brand assets
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "brand_assets_service_all" ON storage.objects;
DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;

CREATE POLICY "brand_assets_service_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'brand-assets') WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'brand-assets');

-- ═══════════════════════════════════════════════════════════════════
-- CONCLUÍDO
-- ═══════════════════════════════════════════════════════════════════
