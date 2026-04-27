-- ─── Migration: Growth Map module ───────────────────────────────────────────
-- Safe to re-run (IF NOT EXISTS).

-- 1. growth_maps — saves canvas state (nodes + edges)
CREATE TABLE IF NOT EXISTS growth_maps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL DEFAULT '',
  description      TEXT        NOT NULL DEFAULT '',
  nodes            JSONB       NOT NULL DEFAULT '[]',
  edges            JSONB       NOT NULL DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  last_executed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON growth_maps;
CREATE POLICY "service_role_bypass" ON growth_maps FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_growth_maps_company ON growth_maps (company_id, created_at DESC);

-- 2. growth_map_executions — execution history
CREATE TABLE IF NOT EXISTS growth_map_executions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID        NOT NULL REFERENCES growth_maps(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  results     JSONB       NOT NULL DEFAULT '{}',
  summary     TEXT        NOT NULL DEFAULT '',
  actions_taken INTEGER   NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_map_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON growth_map_executions;
CREATE POLICY "service_role_bypass" ON growth_map_executions FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_gme_map ON growth_map_executions (map_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gme_company ON growth_map_executions (company_id, created_at DESC);
