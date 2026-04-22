-- ═══════════════════════════════════════════════════════════════════
-- NEXUS — SETUP COMPLETO DO BANCO
-- Cole tudo isso no Supabase SQL Editor e clique em Run
-- ═══════════════════════════════════════════════════════════════════

-- ─── EXTENSÕES ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── FUNÇÃO updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- 1. TABELA users (base de tudo)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID        UNIQUE,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT,
  plan        TEXT        NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. TABELA companies (pode já existir — adiciona colunas faltando)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  sector      TEXT,
  perfil      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sector            TEXT,
  ADD COLUMN IF NOT EXISTS perfil            TEXT,
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS ganho_acumulado   NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS score_before      INTEGER,
  ADD COLUMN IF NOT EXISTS score_after       INTEGER;

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_email   ON companies(email)   WHERE email IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. TABELAS financeiras e operacionais
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

CREATE TABLE IF NOT EXISTS quiz_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  perfil            TEXT,
  nome_empresa      TEXT,
  setor             TEXT,
  meta_mensal       NUMERIC,
  principal_desafio TEXT,
  raw_data          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_leads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT,
  email       TEXT UNIQUE,
  perfil      TEXT,
  respostas   JSONB       NOT NULL DEFAULT '{}',
  fonte       TEXT        NOT NULL DEFAULT 'direct',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. TABELAS que podem já existir — adiciona colunas faltando
-- ═══════════════════════════════════════════════════════════════════

-- actions
CREATE TABLE IF NOT EXISTS actions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS diagnostic_id    UUID REFERENCES diagnostics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titulo           TEXT,
  ADD COLUMN IF NOT EXISTS descricao        TEXT,
  ADD COLUMN IF NOT EXISTS detalhe          TEXT,
  ADD COLUMN IF NOT EXISTS impacto_estimado NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impacto_anual    NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ganho_realizado  NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo            TEXT,
  ADD COLUMN IF NOT EXISTS prioridade       TEXT     DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS urgencia         TEXT     DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS categoria        TEXT,
  ADD COLUMN IF NOT EXISTS icone            TEXT     DEFAULT '💡',
  ADD COLUMN IF NOT EXISTS passos           JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS source           TEXT     DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS effort_level     TEXT     DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS auto_executable  BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_type   TEXT     DEFAULT 'recommendation',
  ADD COLUMN IF NOT EXISTS metadata         JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS executed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_log    TEXT,
  ADD COLUMN IF NOT EXISTS message_email    TEXT,
  ADD COLUMN IF NOT EXISTS message_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- execution_history
CREATE TABLE IF NOT EXISTS execution_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action_id  UUID,
  status     TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE execution_history
  ADD COLUMN IF NOT EXISTS titulo            TEXT,
  ADD COLUMN IF NOT EXISTS execution_type    TEXT,
  ADD COLUMN IF NOT EXISTS ganho_realizado   NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_log     TEXT,
  ADD COLUMN IF NOT EXISTS channel_delivered BOOLEAN,
  ADD COLUMN IF NOT EXISTS channel_simulated BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS channel_error     TEXT,
  ADD COLUMN IF NOT EXISTS executed_at       TIMESTAMPTZ DEFAULT NOW();

-- customers (para invoices/cobrança)
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- invoices
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID        REFERENCES customers(id) ON DELETE SET NULL,
  amount      NUMERIC     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  due_date    DATE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- execution_logs (pode já existir)
CREATE TABLE IF NOT EXISTS execution_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        REFERENCES companies(id) ON DELETE CASCADE,
  action_id    UUID,
  log_text     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. ÍNDICES adicionais
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_financial_data_company ON financial_data(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_company        ON actions(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_company         ON alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_company    ON diagnostics(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user     ON subscriptions(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 6. TRIGGERS updated_at
-- ═══════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_users_updated_at         ON users;
DROP TRIGGER IF EXISTS trg_actions_updated_at       ON actions;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS trg_leads_updated_at         ON onboarding_leads;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_actions_updated_at
  BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON onboarding_leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 7. TRIGGER: Supabase Auth → users (sincronização automática)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, auth_id, email, name, plan, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'free',
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_id    = NEW.id,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY — service_role tem acesso total
--    (o código usa service role key, então isso mantém tudo funcionando)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs    ENABLE ROW LEVEL SECURITY;

-- service_role bypass (para o backend funcionar)
DROP POLICY IF EXISTS "service_full_users"         ON users;
DROP POLICY IF EXISTS "service_full_companies"     ON companies;
DROP POLICY IF EXISTS "service_full_financial"     ON financial_data;
DROP POLICY IF EXISTS "service_full_diagnostics"   ON diagnostics;
DROP POLICY IF EXISTS "service_full_actions"       ON actions;
DROP POLICY IF EXISTS "service_full_alerts"        ON alerts;
DROP POLICY IF EXISTS "service_full_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "service_full_quiz"          ON quiz_responses;
DROP POLICY IF EXISTS "service_full_leads"         ON onboarding_leads;
DROP POLICY IF EXISTS "service_full_customers"     ON customers;
DROP POLICY IF EXISTS "service_full_invoices"      ON invoices;
DROP POLICY IF EXISTS "service_full_exec_history"  ON execution_history;
DROP POLICY IF EXISTS "service_full_exec_logs"     ON execution_logs;

CREATE POLICY "service_full_users"         ON users             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_companies"     ON companies         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_financial"     ON financial_data    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_diagnostics"   ON diagnostics       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_actions"       ON actions           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_alerts"        ON alerts            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_subscriptions" ON subscriptions     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_quiz"          ON quiz_responses    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_leads"         ON onboarding_leads  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_customers"     ON customers         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_invoices"      ON invoices          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_exec_history"  ON execution_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_exec_logs"     ON execution_logs    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 9. VIEW conveniente: empresa do usuário logado
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW my_company AS
  SELECT c.*
  FROM companies c
  JOIN users u ON u.id = c.user_id
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — lista todas as tabelas criadas
-- ═══════════════════════════════════════════════════════════════════
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
