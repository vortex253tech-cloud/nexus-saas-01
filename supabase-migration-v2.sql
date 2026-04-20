-- ─── NEXUS SaaS — Migration v2 ────────────────────────────────
-- Run this in your Supabase SQL Editor after migration v1.

-- ─── users (extends Supabase auth) ────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── companies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sector      TEXT,
  perfil      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── quiz_responses ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  perfil             TEXT,
  nome_empresa       TEXT,
  setor              TEXT,
  meta_mensal        NUMERIC,
  principal_desafio  TEXT,
  raw_data           JSONB,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── financial_data ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_data (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revenue       NUMERIC NOT NULL,
  costs         NUMERIC NOT NULL,
  profit        NUMERIC NOT NULL,
  period_label  TEXT NOT NULL,     -- e.g. "Abril 2025"
  period_date   DATE NOT NULL,     -- first day of the period
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── diagnostics ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score                 INTEGER,
  resumo                TEXT,
  ganho_total_estimado  NUMERIC,
  benchmark_label       TEXT,
  ai_summary            TEXT,
  raw_data              JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── actions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  diagnostic_id     UUID REFERENCES diagnostics(id) ON DELETE SET NULL,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  detalhe           TEXT,
  impacto_estimado  NUMERIC DEFAULT 0,
  ganho_realizado   NUMERIC DEFAULT 0,
  prazo             TEXT,
  prioridade        TEXT DEFAULT 'media',   -- critica | alta | media
  categoria         TEXT,                    -- receita | custo | retencao | operacional | precificacao
  icone             TEXT DEFAULT '💡',
  passos            JSONB DEFAULT '[]',
  status            TEXT DEFAULT 'pending',  -- pending | in_progress | done
  source            TEXT DEFAULT 'ai',       -- ai | manual
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── alerts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,       -- perigo | atencao | oportunidade | info
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  impacto     TEXT,
  lido        BOOLEAN DEFAULT FALSE,
  dismissed   BOOLEAN DEFAULT FALSE,
  source      TEXT DEFAULT 'ai',   -- ai | system
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                     TEXT NOT NULL DEFAULT 'free', -- free | starter | pro | enterprise
  status                   TEXT NOT NULL DEFAULT 'trialing', -- trialing | active | canceled | past_due
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT,
  trial_ends_at            TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  current_period_end       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_user_id       ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_data_company  ON financial_data(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_data_date     ON financial_data(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_actions_company         ON actions(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_status          ON actions(status);
CREATE INDEX IF NOT EXISTS idx_alerts_company          ON alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_company     ON diagnostics(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user      ON subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email      ON users(email);

-- ─── auto update_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data  ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- For demo/no-auth mode the API uses service role key.
