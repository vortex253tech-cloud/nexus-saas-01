-- ─── NEXUS SaaS — Migration v3 ────────────────────────────────
-- Evolui tabela actions para suporte a execução automática.

-- Adicionar colunas novas na tabela actions
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS effort_level    TEXT DEFAULT 'medium',     -- low | medium | high
  ADD COLUMN IF NOT EXISTS auto_executable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_type  TEXT DEFAULT 'recommendation', -- email | whatsapp | ads | recommendation | analytics
  ADD COLUMN IF NOT EXISTS metadata        JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS executed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_log   TEXT;

-- Tabela de histórico de execuções (timeline)
CREATE TABLE IF NOT EXISTS execution_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action_id     UUID REFERENCES actions(id) ON DELETE SET NULL,
  titulo        TEXT NOT NULL,
  execution_type TEXT,
  ganho_realizado NUMERIC DEFAULT 0,
  execution_log TEXT,
  executed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_history_company ON execution_history(company_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_date    ON execution_history(executed_at DESC);

ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;

-- Campo ganho_realizado acumulado na empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ganho_acumulado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT FALSE;

-- RLS policies for execution_history (service role bypasses, but needed for anon)
CREATE POLICY "Company members can read execution_history"
  ON execution_history FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert execution_history"
  ON execution_history FOR INSERT
  WITH CHECK (true);

-- Helper function: increment ganho_acumulado atomically
CREATE OR REPLACE FUNCTION increment_ganho_acumulado(p_company_id UUID, p_value NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE companies
  SET ganho_acumulado = COALESCE(ganho_acumulado, 0) + p_value
  WHERE id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
