-- ─── Migration v2: message_templates + message_logs hardening ──────────────
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Run in Supabase SQL Editor.

-- 1. message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  type        TEXT        NOT NULL DEFAULT 'email'
    CHECK (type IN ('email', 'whatsapp')),
  category    TEXT        NOT NULL DEFAULT 'custom'
    CHECK (category IN ('financial', 'sales', 'relationship', 'custom')),
  subject     TEXT        NOT NULL DEFAULT '',
  content     TEXT        NOT NULL DEFAULT '',
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON message_templates;
CREATE POLICY "service_role_bypass" ON message_templates
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_message_templates_company  ON message_templates (company_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type     ON message_templates (company_id, type);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates (company_id, category);

-- 2. message_logs — ensure it exists with all needed columns
CREATE TABLE IF NOT EXISTS message_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_id UUID        REFERENCES automations(id)             ON DELETE SET NULL,
  enrollment_id UUID        REFERENCES automation_enrollments(id)  ON DELETE SET NULL,
  client_id     UUID        REFERENCES clients(id)                 ON DELETE SET NULL,
  template_id   UUID        REFERENCES message_templates(id)       ON DELETE SET NULL,
  client_name   TEXT,
  channel       TEXT        NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp')),
  to_address    TEXT        NOT NULL DEFAULT '',
  subject       TEXT,
  body_preview  TEXT,
  status        TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'simulated')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add template_id to existing message_logs if migration was run before
ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON message_logs;
CREATE POLICY "service_role_bypass" ON message_logs
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_message_logs_company   ON message_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at   ON message_logs (company_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_client    ON message_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status    ON message_logs (company_id, status);
