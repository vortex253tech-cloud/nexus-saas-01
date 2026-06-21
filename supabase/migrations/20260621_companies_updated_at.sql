-- ─── Fix: companies UPDATE fails — trigger expects updated_at, column never existed ─
-- Some earlier migration attached a generic set_updated_at() trigger to
-- companies (used elsewhere for users/subscriptions), but never added the
-- column itself. Any UPDATE on companies (including the autopilot_enabled
-- toggle wired up in app/dashboard/page.tsx) fails with:
--   "record \"new\" has no field \"updated_at\""
-- Additive, non-destructive fix.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
