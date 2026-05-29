-- ═══════════════════════════════════════════════════════════════════
-- NEXUS WhatsApp V5 — CRM Conversacional
-- Migration: 20260529_whatsapp_v5
-- ═══════════════════════════════════════════════════════════════════

-- ── Extend whatsapp_conversations with CRM fields ─────────────────
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS photo_url        TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS tags             TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pipeline_stage   TEXT    CHECK (pipeline_stage IN ('novo','qualificado','interessado','negociando','proposta','fechado','perdido','cliente')),
  ADD COLUMN IF NOT EXISTS estimated_value  TEXT,
  ADD COLUMN IF NOT EXISTS unread_count     INTEGER NOT NULL DEFAULT 0;

-- ── contacts view (CRM-compatible alias for conversations) ────────
-- Provides the interface the spec asks for without a second table.
-- Each phone+company pair is unique — conversations ARE contacts.
CREATE OR REPLACE VIEW wa_contacts AS
  SELECT
    id,
    company_id,
    phone,
    contact_name   AS name,
    photo_url,
    email,
    tags,
    pipeline_stage,
    estimated_value,
    message_count,
    last_message_at,
    created_at,
    updated_at
  FROM whatsapp_conversations;

-- ── Full-text search indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_conv_name_search
  ON whatsapp_conversations USING GIN (
    to_tsvector('portuguese', coalesce(contact_name,'') || ' ' || coalesce(email,'') || ' ' || phone)
  );

CREATE INDEX IF NOT EXISTS idx_wa_msg_content_search
  ON whatsapp_messages USING GIN (
    to_tsvector('portuguese', content)
  );

-- ── Performance: cover index for sidebar list ─────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_conv_sidebar
  ON whatsapp_conversations (company_id, last_message_at DESC NULLS LAST)
  INCLUDE (phone, contact_name, photo_url, status, ai_enabled, unread_count, message_count);

-- ── Increment unread atomically ───────────────────────────────────
CREATE OR REPLACE FUNCTION wa_increment_unread(p_conv_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE whatsapp_conversations
     SET unread_count = COALESCE(unread_count, 0) + 1,
         updated_at   = now()
   WHERE id = p_conv_id;
END;
$$;

-- ── Reset unread_count when message is read ────────────────────────
-- (called by /api/nexus/whatsapp/read endpoint)
CREATE OR REPLACE FUNCTION wa_mark_read(p_conv_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE whatsapp_conversations
     SET unread_count = 0, updated_at = now()
   WHERE id = p_conv_id;
END;
$$;
