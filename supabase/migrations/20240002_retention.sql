-- ─── Retention Events ────────────────────────────────────────────────────────
-- Tracks every at-risk detection and the action taken to retain the client.

CREATE TABLE IF NOT EXISTS retention_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL,
  reason      text NOT NULL,            -- inactive | overdue_invoice | no_contact
  action_taken text,                    -- send_message | send_offer | create_discount | none
  result      text,                     -- success | failed | pending
  metadata    jsonb DEFAULT '{}',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS retention_events_company_idx ON retention_events(company_id);
CREATE INDEX IF NOT EXISTS retention_events_client_idx  ON retention_events(company_id, client_id);
CREATE INDEX IF NOT EXISTS retention_events_reason_idx  ON retention_events(company_id, reason);

ALTER TABLE retention_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY retention_events_company_isolation ON retention_events
  FOR ALL USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );
