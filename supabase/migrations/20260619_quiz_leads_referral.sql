-- ─── quiz_leads — sistema de indicação (acesso antecipado) ─────────────────
-- Mirrors the working referral mechanic already proven on `waitlist`
-- (supabase-migration-referral.sql): each referral pulls the referrer up
-- the access queue. Adapted for quiz_leads, with one key difference — the
-- insert into this table happens directly from the Lovable app's browser
-- code (anon key, no NEXUS server in the path), so referral_code generation
-- has to happen in the database itself via a trigger, not in application code.

ALTER TABLE quiz_leads
  ADD COLUMN IF NOT EXISTS referral_code   text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by     text REFERENCES quiz_leads(referral_code),
  ADD COLUMN IF NOT EXISTS referrals_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position        integer;

CREATE INDEX IF NOT EXISTS idx_quiz_leads_referral_code ON quiz_leads(referral_code);
CREATE INDEX IF NOT EXISTS idx_quiz_leads_referred_by   ON quiz_leads(referred_by);

-- ─── Backfill existing rows (referral_code + position) ────────────────────

CREATE OR REPLACE FUNCTION generate_quiz_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous I/O/0/1
  code  text;
BEGIN
  code := 'NX-' || (
    SELECT string_agg(substr(chars, (floor(random() * length(chars)) + 1)::int, 1), '')
    FROM generate_series(1, 6)
  );
  RETURN code;
END;
$$;

UPDATE quiz_leads
SET referral_code = generate_quiz_referral_code()
WHERE referral_code IS NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM quiz_leads
)
UPDATE quiz_leads q
SET position = r.rn
FROM ranked r
WHERE q.id = r.id AND q.position IS NULL;

-- ─── Trigger: assign a unique referral_code on insert if missing ──────────

CREATE OR REPLACE FUNCTION quiz_leads_assign_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  candidate text;
  tries     int := 0;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      candidate := generate_quiz_referral_code();
      tries := tries + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM quiz_leads WHERE referral_code = candidate) OR tries > 5;
    END LOOP;
    NEW.referral_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_leads_referral_code ON quiz_leads;
CREATE TRIGGER trg_quiz_leads_referral_code
  BEFORE INSERT ON quiz_leads
  FOR EACH ROW EXECUTE FUNCTION quiz_leads_assign_referral_code();

-- ─── Function: recalculate all positions (each referral = -5 spots) ───────
-- Smaller jump than waitlist's -10: this is a B2B early-access queue, not a
-- public viral waitlist — keep it meaningful without trivializing order.

CREATE OR REPLACE FUNCTION recalculate_quiz_leads_positions()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  base_position integer;
  rec           record;
BEGIN
  FOR rec IN
    SELECT id, referrals_count,
           row_number() OVER (ORDER BY created_at ASC) AS base_pos
    FROM quiz_leads
  LOOP
    base_position := greatest(1, rec.base_pos - (rec.referrals_count * 5));
    UPDATE quiz_leads SET position = base_position WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ─── Trigger: bump referrer's count + recalc positions on referred signup ─

CREATE OR REPLACE FUNCTION handle_quiz_lead_referral()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    UPDATE quiz_leads
    SET referrals_count = referrals_count + 1
    WHERE referral_code = NEW.referred_by;
  END IF;
  PERFORM recalculate_quiz_leads_positions();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_lead_referral ON quiz_leads;
CREATE TRIGGER trg_quiz_lead_referral
  AFTER INSERT ON quiz_leads
  FOR EACH ROW EXECUTE FUNCTION handle_quiz_lead_referral();
