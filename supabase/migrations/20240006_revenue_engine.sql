-- Revenue Engine — schema additions
-- Run this in Supabase SQL Editor before deploying the revenue engine.

-- ── 1. clients: last_interaction + last_invoice_id ────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invoice_id  UUID;

-- ── 2. invoices: client_id + stripe_session_id ───────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- ── 3. collection_logs: revenue engine fields ─────────────────────────────────
ALTER TABLE collection_logs
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS segment      TEXT DEFAULT 'overdue',
  ADD COLUMN IF NOT EXISTS action_type  TEXT DEFAULT 'collect_payment',
  ADD COLUMN IF NOT EXISTS invoice_id   UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- ── 4. revenue_events: accurate recovery tracking ────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id   UUID        REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id  UUID        REFERENCES invoices(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL DEFAULT 'payment_received'
    CHECK (event_type IN ('payment_received', 'manual_recovery', 'subscription_renewed')),
  amount      NUMERIC     NOT NULL DEFAULT 0,
  source      TEXT        DEFAULT 'stripe'
    CHECK (source IN ('stripe', 'manual', 'whatsapp', 'email')),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'revenue_events'
      AND policyname = 'revenue_events_company_isolation'
  ) THEN
    CREATE POLICY "revenue_events_company_isolation"
      ON revenue_events
      USING (
        company_id IN (
          SELECT c.id FROM companies c
          JOIN users u ON u.id = c.user_id
          WHERE u.auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_revenue_events_company_created
  ON revenue_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_logs_invoice
  ON collection_logs (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON invoices (client_id)
  WHERE client_id IS NOT NULL;
