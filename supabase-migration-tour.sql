-- ─── Product Tour: add onboarding columns to users ──────────────────────────
-- Run this in the Supabase SQL editor:
-- https://supabase.com → your project → SQL Editor → New query

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- onboarding_step  : 1-indexed step number (0 = tour not started)
-- onboarding_completed : true once the user finishes or explicitly dismisses
