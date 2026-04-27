-- Flow Executions v2 — step-level logging, SOLID architecture
-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS flow_executions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID        NOT NULL REFERENCES growth_maps(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'error')),
  logs        JSONB       NOT NULL DEFAULT '[]',
  output      JSONB,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass" ON flow_executions
  TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow
  ON flow_executions(flow_id);

CREATE INDEX IF NOT EXISTS idx_flow_executions_company
  ON flow_executions(company_id);

CREATE INDEX IF NOT EXISTS idx_flow_executions_status
  ON flow_executions(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_flow_executions_started
  ON flow_executions(started_at DESC);
