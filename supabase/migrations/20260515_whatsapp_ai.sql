-- ═══════════════════════════════════════════════════════════════════
-- NEXUS WhatsApp AI Engine — Database Schema
-- Migration: 20260515_whatsapp_ai
-- ═══════════════════════════════════════════════════════════════════

-- ── Conversations (one per unique phone+company) ─────────────────
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        REFERENCES companies(id) ON DELETE CASCADE,
  phone           TEXT        NOT NULL,
  contact_name    TEXT,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','closed','blocked')),
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER     NOT NULL DEFAULT 0,
  ai_enabled      BOOLEAN     NOT NULL DEFAULT true,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, phone)
);

-- ── Messages (full history, incoming + outgoing) ─────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  company_id      UUID        REFERENCES companies(id),
  zapi_message_id TEXT        UNIQUE,        -- Z-API message ID (dedup key)
  phone           TEXT        NOT NULL,
  direction       TEXT        NOT NULL CHECK (direction IN ('incoming','outgoing')),
  content         TEXT        NOT NULL,
  content_type    TEXT        NOT NULL DEFAULT 'text'
                              CHECK (content_type IN ('text','image','audio','document','video','sticker')),
  status          TEXT        NOT NULL DEFAULT 'delivered'
                              CHECK (status IN ('pending','sent','delivered','read','failed')),
  from_me         BOOLEAN     NOT NULL DEFAULT false,
  ai_generated    BOOLEAN     NOT NULL DEFAULT false,
  tokens_used     INTEGER,
  processing_ms   INTEGER,
  error           TEXT,
  raw_payload     JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AI Context (persistent memory per conversation) ──────────────
CREATE TABLE IF NOT EXISTS whatsapp_ai_context (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        UNIQUE REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  company_id      UUID        REFERENCES companies(id),
  phone           TEXT        NOT NULL,
  summary         TEXT,
  intent          TEXT,
  lead_score      INTEGER     NOT NULL DEFAULT 0,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  context_data    JSONB       NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Analytics (daily aggregates per company) ─────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_analytics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        REFERENCES companies(id) ON DELETE CASCADE,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  messages_in     INTEGER     NOT NULL DEFAULT 0,
  messages_out    INTEGER     NOT NULL DEFAULT 0,
  new_conversations INTEGER   NOT NULL DEFAULT 0,
  tokens_used     INTEGER     NOT NULL DEFAULT 0,
  errors          INTEGER     NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, date)
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_conversations_company    ON whatsapp_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone      ON whatsapp_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_updated    ON whatsapp_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation    ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone           ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created         ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_zapi_id         ON whatsapp_messages(zapi_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_analytics_company_date   ON whatsapp_analytics(company_id, date DESC);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_ai_context    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_analytics     ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by server-side code)
CREATE POLICY "service_all_conversations" ON whatsapp_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_all_messages" ON whatsapp_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_all_context" ON whatsapp_ai_context
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_all_analytics" ON whatsapp_analytics
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read their own company data
CREATE POLICY "user_read_conversations" ON whatsapp_conversations
  FOR SELECT USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "user_read_messages" ON whatsapp_messages
  FOR SELECT USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "user_read_analytics" ON whatsapp_analytics
  FOR SELECT USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );
