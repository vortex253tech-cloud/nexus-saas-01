-- ─── Migration: Automations System ──────────────────────────────────────────

-- 1. Automations table
CREATE TABLE IF NOT EXISTS automations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  description  TEXT        NOT NULL DEFAULT '',
  trigger_type TEXT        NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'new_client', 'client_overdue')),
  status       TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'inactive', 'draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Automation steps (each step = one email to send after N delay_days)
CREATE TABLE IF NOT EXISTS automation_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_order    INT         NOT NULL DEFAULT 0,
  subject       TEXT        NOT NULL DEFAULT '',
  body_html     TEXT        NOT NULL DEFAULT '',
  delay_days    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enrollment tracking (one row per client per automation)
CREATE TABLE IF NOT EXISTS automation_enrollments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  client_id     UUID        NOT NULL REFERENCES clients(id)     ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  current_step  INT         NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  next_step_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- 4. RLS
ALTER TABLE automations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON automations;
DROP POLICY IF EXISTS "service_role_bypass" ON automation_steps;
DROP POLICY IF EXISTS "service_role_bypass" ON automation_enrollments;

CREATE POLICY "service_role_bypass" ON automations            FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_bypass" ON automation_steps       FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_bypass" ON automation_enrollments FOR ALL TO service_role USING (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_automations_company      ON automations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_steps_automation    ON automation_steps(automation_id, step_order);
CREATE INDEX IF NOT EXISTS idx_auto_enrollments_next    ON automation_enrollments(next_step_at, status);
CREATE INDEX IF NOT EXISTS idx_auto_enrollments_client  ON automation_enrollments(client_id, automation_id);
