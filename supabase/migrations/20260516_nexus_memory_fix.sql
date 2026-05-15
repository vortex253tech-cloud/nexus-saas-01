-- Fix: ai_memory name conflicts with existing table from 20260507_ai_multimodal
-- Rename NEXUS global memory to nexus_memory

CREATE TABLE IF NOT EXISTS nexus_memory (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  fatos       JSONB       NOT NULL DEFAULT '[]',
  padrao_leads JSONB      NOT NULL DEFAULT '{}',
  melhores_abordagens TEXT[],
  objecoes_comuns TEXT[],
  horarios_pico   JSONB   NOT NULL DEFAULT '{}',
  taxa_resposta   NUMERIC DEFAULT 0,
  taxa_conversao  NUMERIC DEFAULT 0,
  notas           TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nexus_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_nexus_memory"  ON nexus_memory FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_nexus_memory"  ON nexus_memory FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- Update the trigger to use nexus_memory
CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pipeline_stages (company_id, nome, cor, posicao, tipo) VALUES
    (NEW.id, 'Novo Lead',    '#6366f1', 0, 'normal'),
    (NEW.id, 'Contatado',    '#8b5cf6', 1, 'normal'),
    (NEW.id, 'Qualificado',  '#f59e0b', 2, 'normal'),
    (NEW.id, 'Proposta',     '#f97316', 3, 'normal'),
    (NEW.id, 'Negociando',   '#ef4444', 4, 'normal'),
    (NEW.id, 'Fechado',      '#10b981', 5, 'fechado'),
    (NEW.id, 'Perdido',      '#6b7280', 6, 'perdido')
  ON CONFLICT DO NOTHING;

  INSERT INTO ai_personas (company_id, nome) VALUES (NEW.id, 'NEXUS AI')
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO nexus_memory (company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;
