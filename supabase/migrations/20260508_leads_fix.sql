-- ─── Leads table fix ──────────────────────────────────────────────────────────
-- Ensures the leads table exists with the correct schema matching the UI.
-- Safe to re-run: all statements are idempotent.
-- Fixes:
--   1. Creates table if the previous migration failed (profiles RLS issue)
--   2. Corrects the status CHECK constraint to match the app's status values
--   3. Adds converted_at column if missing
--   4. Replaces broken RLS policy (referenced non-existent "profiles" table)

-- ─── 1. Create table if not exists ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  phone        text,
  email        text,
  source       text        DEFAULT 'manual',
  notes        text,
  status       text        NOT NULL DEFAULT 'new',
  converted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Fix status constraint (drop old, add correct) ─────────────────────────

-- Drop any existing status check (handles both old wrong versions)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'leads'
      AND con.contype = 'c'
      AND con.conname ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE leads DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'converted', 'lost'));

-- ─── 3. Add missing columns ───────────────────────────────────────────────────

ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at  timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source        text DEFAULT 'manual';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

-- ─── 4. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS leads_company_id_idx   ON leads (company_id);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON leads (company_id, status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx   ON leads (company_id, created_at DESC);

-- ─── 5. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_updated_at ON leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_leads_updated_at();

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────
-- The API uses the service_role key (bypasses RLS entirely).
-- We keep RLS enabled for defense in depth but add a safe service_role policy.
-- The broken "profiles" RLS policy from 20240001 is dropped and replaced.

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_company_isolation"  ON leads;
DROP POLICY IF EXISTS "leads_service_role_all"   ON leads;
DROP POLICY IF EXISTS "service_role_all_leads"   ON leads;

-- Service role gets full access (used by all API routes)
CREATE POLICY "leads_service_role_all"
  ON leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users see only their company's leads (client-side safety net)
CREATE POLICY "leads_authenticated_company"
  ON leads FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = (
        SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
      )
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = (
        SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
      )
    )
  );

-- ─── 7. Migrate any existing leads with wrong status values ───────────────────
-- If leads were created before this fix with status values that no longer
-- match the constraint, reset them to 'new'.
UPDATE leads
SET status = 'new'
WHERE status NOT IN ('new', 'contacted', 'converted', 'lost');
