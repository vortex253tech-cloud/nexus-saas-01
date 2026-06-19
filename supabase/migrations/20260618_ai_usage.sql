-- ─── AI usage counter ───────────────────────────────────────────────────────
-- Backs the 'max_ai_messages' plan limit (lib/nexus-plan.ts) via the existing
-- increment_usage(company_id, field, amount) RPC from 20240003_hardening.sql.

ALTER TABLE company_usage ADD COLUMN IF NOT EXISTS ai_messages_count integer NOT NULL DEFAULT 0;
