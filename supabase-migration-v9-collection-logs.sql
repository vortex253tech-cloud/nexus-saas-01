-- ─── Migration v9: collection_logs — complete schema ─────────────────────────
-- Run once in Supabase SQL Editor.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- 1. Ensure collection_logs exists with the base schema
CREATE TABLE IF NOT EXISTS collection_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL DEFAULT '',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'paid')),
  amount_due  NUMERIC     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add columns introduced after v7 (safe no-ops if already present)
ALTER TABLE collection_logs
  ADD COLUMN IF NOT EXISTS method    TEXT DEFAULT 'email'
    CHECK (method IN ('whatsapp', 'email', 'none')),
  ADD COLUMN IF NOT EXISTS resend_id TEXT;          -- Resend delivery ID for tracking

-- 3. Back-fill method on historical rows
UPDATE collection_logs SET method = 'whatsapp' WHERE method IS NULL;

-- 4. RLS
ALTER TABLE collection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON collection_logs;
CREATE POLICY "service_role_bypass" ON collection_logs
  FOR ALL TO service_role USING (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_collection_logs_company    ON collection_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_client     ON collection_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_status     ON collection_logs (status);
CREATE INDEX IF NOT EXISTS idx_collection_logs_method     ON collection_logs (method);
CREATE INDEX IF NOT EXISTS idx_collection_logs_sent_at    ON collection_logs (sent_at);

-- Composite index used by the dedup query (company + method + status + sent_at)
CREATE INDEX IF NOT EXISTS idx_collection_logs_dedup
  ON collection_logs (company_id, method, status, sent_at);
