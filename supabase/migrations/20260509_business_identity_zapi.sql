-- ─── Z-API fields on business_identity ──────────────────────────────────────
-- Adds per-company Z-API credentials (instance + token).
-- Safe to run even if columns already exist.

ALTER TABLE business_identity
  ADD COLUMN IF NOT EXISTS zapi_instance_id  text,
  ADD COLUMN IF NOT EXISTS zapi_token_enc    text,   -- AES-256-GCM encrypted
  ADD COLUMN IF NOT EXISTS zapi_client_token text;   -- Client-Token header (optional, some plans require it)
