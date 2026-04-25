-- ─── Migration: Message Logs ─────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable message history tracking.

CREATE TABLE IF NOT EXISTS message_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_id UUID        REFERENCES automations(id) ON DELETE SET NULL,
  enrollment_id UUID        REFERENCES automation_enrollments(id) ON DELETE SET NULL,
  client_id     UUID        REFERENCES clients(id) ON DELETE SET NULL,
  client_name   TEXT,
  channel       TEXT        NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp')),
  to_address    TEXT        NOT NULL,
  subject       TEXT,
  body_preview  TEXT,
  status        TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'simulated')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON message_logs;
CREATE POLICY "service_role_bypass" ON message_logs
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_message_logs_company
  ON message_logs(company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_automation
  ON message_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_client
  ON message_logs(client_id);
