-- ═══════════════════════════════════════════════════════════════════
-- NEXUS WhatsApp — Enrichment columns + atomic counter RPCs
-- Migration: 20260518_wa_enrichment
-- Apply via: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Add enrichment columns ───────────────────────────────────────
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS label TEXT
    CHECK (label IN ('lead','cliente','negociacao','recuperacao')),
  ADD COLUMN IF NOT EXISTS temperatura TEXT DEFAULT 'frio'
    CHECK (temperatura IN ('frio','morno','quente','urgente')),
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

-- Index for fast filter queries
CREATE INDEX IF NOT EXISTS idx_wa_conversations_temperatura
  ON whatsapp_conversations(company_id, temperatura);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_label
  ON whatsapp_conversations(company_id, label);

-- ── Atomic counter increment ─────────────────────────────────────
-- Called from webhook after saving both messages.
-- p_msg_inc:    number of messages saved (usually 2 = in + out)
-- p_unread_inc: number of unread messages (usually 1 = only incoming)
CREATE OR REPLACE FUNCTION wa_inc_message_count(
  p_conv_id    UUID,
  p_msg_inc    INTEGER DEFAULT 2,
  p_unread_inc INTEGER DEFAULT 1
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET
    message_count = message_count + p_msg_inc,
    unread_count  = unread_count  + p_unread_inc
  WHERE id = p_conv_id;
END;
$$;

-- ── Mark conversation as read ────────────────────────────────────
-- Called when the user opens a conversation in the UI.
CREATE OR REPLACE FUNCTION wa_mark_read(p_conv_id UUID)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = 0
  WHERE id = p_conv_id;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION wa_inc_message_count(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION wa_mark_read(UUID) TO service_role;
