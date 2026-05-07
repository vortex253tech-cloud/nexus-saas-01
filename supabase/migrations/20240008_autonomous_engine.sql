-- Autonomous Revenue Engine — schema additions
-- Run this in Supabase SQL Editor before deploying.
-- All changes are idempotent (IF NOT EXISTS / IF NOT EXISTS + DO $$).

-- ── 1. companies: engine safety controls ─────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS approval_mode        TEXT    NOT NULL DEFAULT 'auto'
    CHECK (approval_mode IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS max_actions_per_day  INT     NOT NULL DEFAULT 20;

-- ── 2. actions: source_trigger for dedup by engine ───────────────────────────
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS source_trigger  TEXT,   -- RECOVERY_FLOW | SALES_FLOW | …
  ADD COLUMN IF NOT EXISTS metadata        JSONB;  -- decision metadata blob

CREATE INDEX IF NOT EXISTS idx_actions_source_trigger
  ON actions (company_id, source_trigger, status)
  WHERE source_trigger IS NOT NULL;

-- ── 3. engine_runs: full log of each ai-runner cron execution ─────────────────
CREATE TABLE IF NOT EXISTS engine_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decisions_found   INT         NOT NULL DEFAULT 0,
  actions_inserted  INT         NOT NULL DEFAULT 0,
  actions_skipped   INT         NOT NULL DEFAULT 0,
  actions_executed  INT         NOT NULL DEFAULT 0,
  actions_failed    INT         NOT NULL DEFAULT 0,
  revenue_impact    NUMERIC     NOT NULL DEFAULT 0,
  approval_mode     TEXT        NOT NULL DEFAULT 'auto',
  summary           TEXT,
  report_json       JSONB,
  error             TEXT
);

ALTER TABLE engine_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'engine_runs'
      AND policyname = 'engine_runs_company_isolation'
  ) THEN
    CREATE POLICY "engine_runs_company_isolation"
      ON engine_runs
      USING (
        company_id IN (
          SELECT c.id FROM companies c
          JOIN users u ON u.id = c.user_id
          WHERE u.auth_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_engine_runs_company_run
  ON engine_runs (company_id, run_at DESC);

-- ── 4. engine_action_logs: per-action outcome tracking (learning) ─────────────
CREATE TABLE IF NOT EXISTS engine_action_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   TEXT        NOT NULL,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger     TEXT        NOT NULL,
  channel     TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'skipped')),
  outcome     TEXT,
  ganho       NUMERIC     NOT NULL DEFAULT 0,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB
);

ALTER TABLE engine_action_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'engine_action_logs'
      AND policyname = 'engine_action_logs_company_isolation'
  ) THEN
    CREATE POLICY "engine_action_logs_company_isolation"
      ON engine_action_logs
      USING (
        company_id IN (
          SELECT c.id FROM companies c
          JOIN users u ON u.id = c.user_id
          WHERE u.auth_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_engine_action_logs_company
  ON engine_action_logs (company_id, timestamp DESC);

-- ── 5. automation_flows: queue for the flow-queue cron ───────────────────────
CREATE TABLE IF NOT EXISTS automation_flows (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  flow_type       TEXT        NOT NULL
    CHECK (flow_type IN ('recovery', 'sales', 'reactivation', 'upsell', 'collection')),
  target_id       TEXT        NOT NULL,    -- client or lead UUID as text
  status          TEXT        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed')),
  trigger_source  TEXT,                    -- action_id that created this
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_flows'
      AND policyname = 'automation_flows_company_isolation'
  ) THEN
    CREATE POLICY "automation_flows_company_isolation"
      ON automation_flows
      USING (
        company_id IN (
          SELECT c.id FROM companies c
          JOIN users u ON u.id = c.user_id
          WHERE u.auth_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_flows_queued
  ON automation_flows (company_id, status, created_at)
  WHERE status = 'queued';

-- ── 6. leads: last_followup_at (needed by decision engine) ───────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;
