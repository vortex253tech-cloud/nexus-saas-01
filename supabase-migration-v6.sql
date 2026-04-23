-- ═══════════════════════════════════════════════════════════════════
-- NEXUS — MIGRATION v6: Clients, Transactions, Checklist, Trial
-- Cole no Supabase SQL Editor e clique em Run
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colunas extras na tabela companies ─────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS principal_desafio TEXT,
  ADD COLUMN IF NOT EXISTS meta_mensal       NUMERIC DEFAULT 50000;

-- ─── 2. Garantir trial_ends_at na tabela subscriptions ────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- ─── 3. TABELA clients ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  email         TEXT,
  phone         TEXT,
  total_revenue NUMERIC     NOT NULL DEFAULT 0,
  origem        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 4. TABELA client_transactions ────────────────────────────────
CREATE TABLE IF NOT EXISTS client_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount      NUMERIC     NOT NULL,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_client_id  ON client_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON client_transactions(company_id);

-- ─── 5. TABELA checklist_progress ─────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action_id    TEXT        NOT NULL,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_company_id ON checklist_progress(company_id);

-- ─── 6. RLS para novas tabelas ─────────────────────────────────────
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_progress   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_full_clients"       ON clients;
DROP POLICY IF EXISTS "service_full_transactions"  ON client_transactions;
DROP POLICY IF EXISTS "service_full_checklist"     ON checklist_progress;

CREATE POLICY "service_full_clients"
  ON clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_transactions"
  ON client_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_checklist"
  ON checklist_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 7. Atualizar subscriptions existentes sem trial_ends_at ───────
UPDATE subscriptions
SET trial_ends_at = created_at + INTERVAL '7 days'
WHERE trial_ends_at IS NULL AND status = 'trialing';
