-- ─── Consolidated migration: apply hardening + onboarding ────────────────────
-- Fixes RLS policies to use the real schema (users + companies, no profiles table).
-- Safe to run multiple times — all statements use IF NOT EXISTS / OR REPLACE.

-- ─── 1. flow_errors ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flow_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  flow_id       uuid,
  execution_id  text,
  node_id       text,
  node_type     text,
  error_code    text,
  message       text        NOT NULL,
  stack         text,
  context       jsonb       DEFAULT '{}',
  resolved      boolean     NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_errors_company    ON flow_errors(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_errors_unresolved ON flow_errors(company_id, resolved) WHERE NOT resolved;

ALTER TABLE flow_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_errors_company_isolation" ON flow_errors;
CREATE POLICY "flow_errors_company_isolation" ON flow_errors
  USING (
    company_id = (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── 2. Company branding (white-label) ───────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS brand_name  text,
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#6366f1';

-- ─── 3. company_usage ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_usage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  plan                text        NOT NULL DEFAULT 'free',
  automations_count   integer     NOT NULL DEFAULT 0,
  messages_sent       integer     NOT NULL DEFAULT 0,
  clients_tracked     integer     NOT NULL DEFAULT 0,
  payment_links_gen   integer     NOT NULL DEFAULT 0,
  period_start        date        NOT NULL DEFAULT date_trunc('month', now()),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_usage_company ON company_usage(company_id);

ALTER TABLE company_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_usage_isolation" ON company_usage;
CREATE POLICY "company_usage_isolation" ON company_usage
  USING (
    company_id = (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1
    )
  );

CREATE OR REPLACE FUNCTION ensure_company_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO company_usage(company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_company_usage ON companies;
CREATE TRIGGER trg_ensure_company_usage
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION ensure_company_usage();

CREATE OR REPLACE FUNCTION increment_usage(
  p_company_id uuid,
  p_field      text,
  p_amount     integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO company_usage(company_id, period_start)
    VALUES (p_company_id, date_trunc('month', now()))
  ON CONFLICT (company_id) DO NOTHING;

  EXECUTE format(
    'UPDATE company_usage SET %I = %I + $1, updated_at = now() WHERE company_id = $2',
    p_field, p_field
  ) USING p_amount, p_company_id;
END;
$$;

-- ─── 4. Onboarding tracking ───────────────────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_completed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ─── 5. customers table (invoice contacts) ───────────────────────────────────
-- May already exist; all statements guarded.

CREATE TABLE IF NOT EXISTS customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_company_isolation" ON customers;
CREATE POLICY "customers_company_isolation" ON customers
  USING (
    company_id = (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── 6. invoices table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id  uuid        REFERENCES customers(id) ON DELETE SET NULL,
  amount       numeric(12,2) NOT NULL,
  currency     text        NOT NULL DEFAULT 'BRL',
  status       text        NOT NULL DEFAULT 'pending',  -- pending | paid | overdue | cancelled
  due_date     date,
  description  text,
  payment_link text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company  ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(company_id, status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_company_isolation" ON invoices;
CREATE POLICY "invoices_company_isolation" ON invoices
  USING (
    company_id = (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1
    )
  );
