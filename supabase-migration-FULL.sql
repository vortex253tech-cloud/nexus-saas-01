-- ═══════════════════════════════════════════════════════════════════
-- NEXUS SaaS — SCHEMA COMPLETO (compatível com Supabase/Postgres)
-- Parte do banco já existe (companies, actions, execution_history,
-- execution_logs, profiles). Este script completa tudo.
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
-- TABELAS NOVAS (que ainda não existem)
-- ═══════════════════════════════════════════════════════════════════

-- users (app users, separado do auth.users do Supabase)
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT,
  plan        TEXT        NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- onboarding_leads
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

-- quiz_responses
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

-- financial_data
CREATE TABLE IF NOT EXISTS financial_data (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revenue       NUMERIC     NOT NULL,
  costs         NUMERIC     NOT NULL,
  profit        NUMERIC     NOT NULL,
  period_label  TEXT        NOT NULL,
  period_date   DATE        NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- diagnostics
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

-- subscriptions
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

-- ═══════════════════════════════════════════════════════════════════
-- COLUNAS FALTANDO NAS TABELAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════

-- companies: adicionar colunas que o código espera
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sector            TEXT,
  ADD COLUMN IF NOT EXISTS perfil            TEXT,
  ADD COLUMN IF NOT EXISTS ganho_acumulado   NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS score_before      INTEGER,
  ADD COLUMN IF NOT EXISTS score_after       INTEGER;

-- actions: renomear title→titulo e description→descricao (se ainda existirem com o nome antigo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='actions' AND column_name='title') THEN
    ALTER TABLE actions RENAME COLUMN title TO titulo;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='actions' AND column_name='description') THEN
    ALTER TABLE actions RENAME COLUMN description TO descricao;
  END IF;
END $$;

-- actions: adicionar colunas faltando
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

-- execution_history: adicionar colunas faltando
ALTER TABLE execution_history
  ADD COLUMN IF NOT EXISTS titulo            TEXT,
  ADD COLUMN IF NOT EXISTS execution_type    TEXT,
  ADD COLUMN IF NOT EXISTS ganho_realizado   NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_log     TEXT,
  ADD COLUMN IF NOT EXISTS channel_delivered BOOLEAN,
  ADD COLUMN IF NOT EXISTS channel_simulated BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS channel_error     TEXT,
  ADD COLUMN IF NOT EXISTS executed_at       TIMESTAMPTZ DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_email               ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_email               ON onboarding_leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_user_id         ON companies(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_email           ON companies(email)  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_phone           ON companies(phone)  WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_data_company    ON financial_data(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_data_date       ON financial_data(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_actions_company           ON actions(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_status            ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_urgencia          ON actions(urgencia)  WHERE urgencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_company_status    ON actions(company_id, status) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_company            ON alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_company       ON diagnostics(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user        ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_exec_history_company      ON execution_history(company_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_company         ON execution_logs(company_id);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGERS (updated_at)
-- ═══════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_users_updated_at            ON users;
DROP TRIGGER IF EXISTS trg_actions_updated_at          ON actions;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at    ON subscriptions;
DROP TRIGGER IF EXISTS trg_leads_updated_at            ON onboarding_leads;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON onboarding_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- FUNÇÃO: incrementar ganho acumulado atomicamente
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION increment_ganho_acumulado(p_company_id UUID, p_value NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE companies
  SET ganho_acumulado = COALESCE(ganho_acumulado, 0) + p_value
  WHERE id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Padrão: DROP IF EXISTS + CREATE (evita o erro de IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS "service_full_users" ON users;
CREATE POLICY "service_full_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- onboarding_leads
DROP POLICY IF EXISTS "service_full_leads" ON onboarding_leads;
CREATE POLICY "service_full_leads" ON onboarding_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- companies
DROP POLICY IF EXISTS "service_full_companies" ON companies;
CREATE POLICY "service_full_companies" ON companies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- quiz_responses
DROP POLICY IF EXISTS "service_full_quiz" ON quiz_responses;
CREATE POLICY "service_full_quiz" ON quiz_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- financial_data
DROP POLICY IF EXISTS "service_full_financial" ON financial_data;
CREATE POLICY "service_full_financial" ON financial_data FOR ALL TO service_role USING (true) WITH CHECK (true);

-- diagnostics
DROP POLICY IF EXISTS "service_full_diagnostics" ON diagnostics;
CREATE POLICY "service_full_diagnostics" ON diagnostics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- actions
DROP POLICY IF EXISTS "service_full_actions" ON actions;
CREATE POLICY "service_full_actions" ON actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- alerts
DROP POLICY IF EXISTS "service_full_alerts" ON alerts;
CREATE POLICY "service_full_alerts" ON alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- subscriptions
DROP POLICY IF EXISTS "service_full_subscriptions" ON subscriptions;
CREATE POLICY "service_full_subscriptions" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- execution_history
DROP POLICY IF EXISTS "service_full_exec_history" ON execution_history;
CREATE POLICY "service_full_exec_history" ON execution_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- execution_logs
DROP POLICY IF EXISTS "service_full_exec_logs" ON execution_logs;
CREATE POLICY "service_full_exec_logs" ON execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL — deve listar todas as 11+ tabelas
-- ═══════════════════════════════════════════════════════════════════

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
