-- ═══════════════════════════════════════════════════════════════════
-- NEXUS Lead Context — memória de conversa por lead
-- Migration: 20260515_lead_context
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_context (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        UNIQUE REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  company_id      UUID        REFERENCES companies(id),
  phone           TEXT        NOT NULL,

  -- Dados do lead
  nome            TEXT,
  nicho           TEXT,                         -- segmento/mercado
  faturamento     TEXT,                         -- ex: "R$50k/mês"
  funcionarios    TEXT,                         -- ex: "10-50"
  dores           TEXT[]      NOT NULL DEFAULT '{}',
  objetivo        TEXT,
  empresa         TEXT,

  -- Qualificação
  estagio         TEXT        NOT NULL DEFAULT 'novo'
                              CHECK (estagio IN ('novo','qualificado','interessado','negociando','cliente','perdido')),
  usa_crm         BOOLEAN,
  usa_automacao   BOOLEAN,
  perde_whatsapp  BOOLEAN,
  score           INTEGER     NOT NULL DEFAULT 0,  -- 0-100

  -- Notas livres e dados extras
  notas           TEXT,
  context_data    JSONB       NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_context_phone      ON lead_context(phone);
CREATE INDEX IF NOT EXISTS idx_lead_context_company    ON lead_context(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_context_estagio    ON lead_context(estagio);

ALTER TABLE lead_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_lead_context" ON lead_context
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "user_read_lead_context" ON lead_context
  FOR SELECT USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );
