-- ─── NEXUS SaaS — Migration v4 ────────────────────────────────
-- Score tracking, urgência, impacto anual.

-- Score de saúde financeira antes/depois de executar ações
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS score_before INTEGER,
  ADD COLUMN IF NOT EXISTS score_after  INTEGER;

-- Campos adicionais em actions (Phase 9)
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS urgencia      TEXT DEFAULT 'media',   -- alta | media | baixa
  ADD COLUMN IF NOT EXISTS impacto_anual NUMERIC DEFAULT 0;

-- Índice para queries de urgência
CREATE INDEX IF NOT EXISTS idx_actions_urgencia ON actions(urgencia);
CREATE INDEX IF NOT EXISTS idx_actions_company_status ON actions(company_id, status);
