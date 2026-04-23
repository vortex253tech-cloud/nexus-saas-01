-- NEXUS Migration v8 — Auto-Pilot engine tables
-- Run in Supabase SQL Editor

-- ─── autopilot_enabled per company ───────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS autopilot_enabled boolean NOT NULL DEFAULT false;

-- ─── autopilot_logs — one row per run ────────────────────────────
CREATE TABLE IF NOT EXISTS autopilot_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  triggered_by     text        NOT NULL DEFAULT 'cron',  -- 'cron' | 'user' | 'api'
  actions_executed int         NOT NULL DEFAULT 0,
  actions_failed   int         NOT NULL DEFAULT 0,
  whatsapp_sent    int         NOT NULL DEFAULT 0,
  new_insights     int         NOT NULL DEFAULT 0,
  ai_summary       text,
  results          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS — service role bypasses; users cannot directly read logs
ALTER TABLE autopilot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON autopilot_logs
  FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autopilot_logs_company_id  ON autopilot_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_logs_created_at  ON autopilot_logs (created_at DESC);
