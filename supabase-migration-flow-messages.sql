-- messages — persists every email/whatsapp sent by the Flow Engine
-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  execution_id  UUID,                   -- links to flow_executions (no FK — optional)
  type          TEXT        NOT NULL
    CHECK (type IN ('email', 'whatsapp')),
  recipient     TEXT        NOT NULL,   -- email address or E.164 phone
  subject       TEXT,                   -- email only
  content       TEXT        NOT NULL,   -- rendered HTML or whatsapp body
  status        TEXT        NOT NULL DEFAULT 'simulated'
    CHECK (status IN ('sent', 'simulated', 'failed')),
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON messages;
CREATE POLICY "service_role_bypass" ON messages
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_messages_company
  ON messages(company_id);

CREATE INDEX IF NOT EXISTS idx_messages_execution
  ON messages(execution_id)
  WHERE execution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_type
  ON messages(type);

CREATE INDEX IF NOT EXISTS idx_messages_created
  ON messages(created_at DESC);
