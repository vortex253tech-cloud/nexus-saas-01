-- ─── Hardening migration ────────────────────────────────────────────────────
-- 1. flow_errors table — global error log for the flow engine
-- 2. Company branding fields — white-label support
-- 3. Plans / usage tracking — monetisation scaffolding

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

CREATE INDEX IF NOT EXISTS idx_flow_errors_company ON flow_errors(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_errors_unresolved ON flow_errors(company_id, resolved) WHERE NOT resolved;

-- RLS: users see only their company's errors
ALTER TABLE flow_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_errors_company_isolation" ON flow_errors;
CREATE POLICY "flow_errors_company_isolation" ON flow_errors
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── 2. Company branding (white-label) ───────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS brand_name  text,
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#6366f1';

-- ─── 3. Plans + usage tracking ───────────────────────────────────────────────

-- Usage counters (reset monthly)
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
      SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Auto-provision usage row when a company is created
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

-- Helper: increment a usage counter safely (UPSERT)
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
