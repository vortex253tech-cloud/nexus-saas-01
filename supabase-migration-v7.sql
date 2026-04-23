-- ─── Migration v7: Debt Collection System ────────────────────────────────────
-- Adds due_date + status to clients
-- Creates collection_logs table

-- 1. Add payment fields to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status   TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue'));

-- 2. Create collection_logs
CREATE TABLE IF NOT EXISTS collection_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL DEFAULT '',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'paid')),
  amount_due  NUMERIC     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE collection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON collection_logs;
CREATE POLICY "service_role_bypass" ON collection_logs
  FOR ALL TO service_role USING (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_collection_logs_company   ON collection_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_client    ON collection_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_status    ON collection_logs(status);
CREATE INDEX IF NOT EXISTS idx_clients_status            ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_due_date          ON clients(due_date);
