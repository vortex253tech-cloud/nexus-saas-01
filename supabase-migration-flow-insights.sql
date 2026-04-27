-- Flow Insights — auto-optimization suggestions per execution
-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS flow_insights (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID        NOT NULL,
  flow_id      UUID        NOT NULL REFERENCES growth_maps(id) ON DELETE CASCADE,
  company_id   UUID        NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  score        INTEGER     NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  insights     JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON flow_insights;
CREATE POLICY "service_role_bypass" ON flow_insights
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_flow_insights_execution
  ON flow_insights(execution_id);

CREATE INDEX IF NOT EXISTS idx_flow_insights_flow
  ON flow_insights(flow_id);

CREATE INDEX IF NOT EXISTS idx_flow_insights_company
  ON flow_insights(company_id);

CREATE INDEX IF NOT EXISTS idx_flow_insights_created
  ON flow_insights(created_at DESC);
