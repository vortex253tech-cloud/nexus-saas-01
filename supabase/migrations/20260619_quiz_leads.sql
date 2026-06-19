-- ─── quiz_leads ────────────────────────────────────────────────────────────
-- Recreates the table the Lovable-built diagnostic quiz writes to. The quiz
-- was originally provisioned on its own, separate Supabase project
-- (Lovable Cloud auto-created it) instead of this one — this migration
-- mirrors that schema exactly so the live form keeps working once the
-- Lovable app's backend connection is switched to this project.
-- See docs/decisoes.md for the full context.

CREATE TABLE IF NOT EXISTS quiz_leads (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  name                        text        NOT NULL,
  company_name                text        NOT NULL,
  email                       text        NOT NULL,
  whatsapp                    text        NOT NULL,
  company_type                text,
  company_size                text,
  main_problem                text,
  automation_level            integer,
  data_decision_level         text,
  business_dependency_level   text,
  operational_score           integer,
  operational_status          text,
  ai_diagnosis                text,
  estimated_loss              text,
  estimated_growth            text,
  source                      text        DEFAULT 'nexus_quiz',
  pipeline_stage              text        NOT NULL DEFAULT 'novo'
    CHECK (pipeline_stage IN ('novo', 'contato', 'reuniao', 'proposta', 'fechado', 'perdido')),
  lead_temperature            text
    CHECK (lead_temperature IN ('frio', 'morno', 'quente')),
  report_sent_at              timestamptz,
  last_contact_at             timestamptz,
  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_quiz_leads_email      ON quiz_leads(email);
CREATE INDEX IF NOT EXISTS idx_quiz_leads_created_at ON quiz_leads(created_at DESC);

-- ─── Trigger: derive lead_temperature from operational_score, bump updated_at ─

CREATE OR REPLACE FUNCTION quiz_leads_set_temperature()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.lead_temperature := CASE
    WHEN NEW.operational_score IS NULL     THEN 'frio'
    WHEN NEW.operational_score >= 70       THEN 'quente'
    WHEN NEW.operational_score >= 40       THEN 'morno'
    ELSE 'frio'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_leads_temperature ON quiz_leads;
CREATE TRIGGER trg_quiz_leads_temperature
  BEFORE INSERT OR UPDATE ON quiz_leads
  FOR EACH ROW EXECUTE FUNCTION quiz_leads_set_temperature();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- The live quiz form inserts directly from the browser using the anon key —
-- that's the one policy that must exist for the funnel to keep working.
-- Admin reads go through NEXUS's own service-role-backed API routes (same
-- pattern as /api/admin/waitlist), not a Postgres role system — this repo
-- has no has_role()/user_roles RBAC to mirror from the original project.

ALTER TABLE quiz_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_leads_service_role_all" ON quiz_leads;
DROP POLICY IF EXISTS "quiz_leads_anon_insert"       ON quiz_leads;

CREATE POLICY "quiz_leads_service_role_all"
  ON quiz_leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "quiz_leads_anon_insert"
  ON quiz_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
