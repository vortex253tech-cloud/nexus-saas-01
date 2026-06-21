-- ─── Fix: referral trigger functions need SECURITY DEFINER ────────────────
-- The mirror insert into quiz_leads runs as the `anon` role (NEXUS's anon
-- key, called from the Lovable app's browser). RLS on quiz_leads only grants
-- `anon` INSERT, not UPDATE/SELECT. Without SECURITY DEFINER, the AFTER
-- INSERT trigger's internal UPDATE (referrals_count) and the SELECT inside
-- recalculate_quiz_leads_positions() run as the invoking role (anon) and
-- silently affect zero rows under RLS — no error, but referrals_count and
-- position never update for anon-originated inserts (only worked in testing
-- because service_role bypasses RLS).

ALTER FUNCTION handle_quiz_lead_referral() SECURITY DEFINER;
ALTER FUNCTION handle_quiz_lead_referral() SET search_path = public;

ALTER FUNCTION recalculate_quiz_leads_positions() SECURITY DEFINER;
ALTER FUNCTION recalculate_quiz_leads_positions() SET search_path = public;

-- One-off backfill: recompute positions now that the function can actually
-- see/update all rows under its own privileges.
SELECT recalculate_quiz_leads_positions();
