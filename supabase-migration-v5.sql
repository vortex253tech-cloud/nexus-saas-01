-- ─── NEXUS SaaS — Migration v5 ────────────────────────────────
-- Real execution: email/WhatsApp fields, execution_logs table,
-- message templates on actions, phone on companies.

-- ─── 1. Companies: add contact fields ─────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS email TEXT,       -- Contact email for action delivery
  ADD COLUMN IF NOT EXISTS phone TEXT;       -- WhatsApp number (E.164: +5511999999999)

-- ─── 2. Actions: add message template fields ──────────────────

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS message_email    TEXT,   -- Ready-to-send email body
  ADD COLUMN IF NOT EXISTS message_whatsapp TEXT;   -- Ready-to-send WhatsApp message (≤300 chars)

-- ─── 3. Execution logs (detailed per-channel results) ─────────

CREATE TABLE IF NOT EXISTS execution_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   UUID REFERENCES actions(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,         -- email | whatsapp | ads | recommendation | analytics
  status      TEXT NOT NULL,         -- delivered | failed | completed | simulated
  response    JSONB,                 -- Raw channel response (Resend ID, Meta messageId, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_logs_company   ON execution_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_action    ON execution_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created   ON execution_logs(created_at DESC);

-- ─── 4. RLS for new table ─────────────────────────────────────

ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — used by server-side executor
CREATE POLICY "Service role full access on execution_logs"
  ON execution_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 5. Indexes for company contact lookups ───────────────────

CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies(phone) WHERE phone IS NOT NULL;

-- ─── 6. Update execution_history: add channel_result field ────

ALTER TABLE execution_history
  ADD COLUMN IF NOT EXISTS channel_delivered BOOLEAN,
  ADD COLUMN IF NOT EXISTS channel_simulated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel_error     TEXT;
