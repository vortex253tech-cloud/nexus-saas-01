-- ═══════════════════════════════════════════════════════════════════
-- NEXUS CORE — Sistema Operacional Comercial Multi-Tenant
-- Migration: 20260516_nexus_core
-- Builds on existing: leads, companies, automations, whatsapp_*
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. ENHANCE LEADS TABLE ──────────────────────────────────────────
-- Adds fields for full CRM + AI qualification

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS empresa         TEXT,
  ADD COLUMN IF NOT EXISTS nicho           TEXT,
  ADD COLUMN IF NOT EXISTS score           INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temperatura     TEXT     NOT NULL DEFAULT 'frio'
    CHECK (temperatura IN ('frio','morno','quente','urgente')),
  ADD COLUMN IF NOT EXISTS stage           TEXT     NOT NULL DEFAULT 'novo'
    CHECK (stage IN ('novo','contatado','qualificado','proposta','negociando','fechado','perdido')),
  ADD COLUMN IF NOT EXISTS origem          TEXT     DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tags            TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS valor_potencial NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes_ia  TEXT,
  ADD COLUMN IF NOT EXISTS ultima_interacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proximo_followup TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canal           TEXT     DEFAULT 'whatsapp'
    CHECK (canal IN ('whatsapp','email','manual','instagram','outro')),
  ADD COLUMN IF NOT EXISTS revenue         NUMERIC  DEFAULT 0;

CREATE INDEX IF NOT EXISTS leads_score_idx       ON leads (company_id, score DESC);
CREATE INDEX IF NOT EXISTS leads_temperatura_idx ON leads (company_id, temperatura);
CREATE INDEX IF NOT EXISTS leads_stage_idx       ON leads (company_id, stage);
CREATE INDEX IF NOT EXISTS leads_followup_idx    ON leads (proximo_followup) WHERE proximo_followup IS NOT NULL;

-- ── 2. AI PERSONAS — IA treinada por empresa ─────────────────────────

CREATE TABLE IF NOT EXISTS ai_personas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT        NOT NULL DEFAULT 'NEXUS AI',
  nicho           TEXT,
  tom             TEXT        NOT NULL DEFAULT 'executivo'
    CHECK (tom IN ('executivo','consultivo','amigavel','tecnico','vendedor','premium')),
  objetivo        TEXT        NOT NULL DEFAULT 'agendar_call'
    CHECK (objetivo IN ('agendar_call','vender_direto','qualificar','nutrir','reativar')),
  abordagem       TEXT        DEFAULT 'challenger',
  produto_foco    TEXT,
  publico_alvo    TEXT,
  dores_cliente   TEXT[],
  diferenciais    TEXT[],
  objecoes        JSONB       DEFAULT '[]',
  instrucoes      TEXT,
  saudacao        TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_personas"   ON ai_personas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_personas"   ON ai_personas FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 3. PRODUCTS — Catálogo de produtos/ofertas por empresa ────────────

CREATE TABLE IF NOT EXISTS products (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT        NOT NULL,
  descricao       TEXT,
  preco           NUMERIC     NOT NULL DEFAULT 0,
  preco_original  NUMERIC,
  tipo            TEXT        NOT NULL DEFAULT 'servico'
    CHECK (tipo IN ('produto','servico','assinatura','consultoria','curso','outro')),
  objetivo        TEXT,
  publico_alvo    TEXT,
  dores_resolve   TEXT[],
  objecoes        TEXT[],
  diferenciais    TEXT[],
  tom_ia          TEXT        DEFAULT 'executivo',
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_products" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_products" ON products FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 4. PIPELINE STAGES — Estágios do funil por empresa ───────────────

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  cor         TEXT        DEFAULT '#6366f1',
  posicao     INTEGER     NOT NULL DEFAULT 0,
  tipo        TEXT        NOT NULL DEFAULT 'normal'
    CHECK (tipo IN ('normal','fechado','perdido')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_company ON pipeline_stages(company_id, posicao);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_pipeline"  ON pipeline_stages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_pipeline"  ON pipeline_stages FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 5. AI TASKS — Tarefas agendadas pela IA (follow-ups) ─────────────

CREATE TABLE IF NOT EXISTS ai_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id         UUID        REFERENCES leads(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL
    CHECK (tipo IN ('followup','proposta','reativacao','agendamento','mensagem','ligacao')),
  canal           TEXT        NOT NULL DEFAULT 'whatsapp'
    CHECK (canal IN ('whatsapp','email','manual')),
  status          TEXT        NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','executando','concluido','cancelado','falhou')),
  prioridade      INTEGER     NOT NULL DEFAULT 5,
  agendado_para   TIMESTAMPTZ NOT NULL,
  executado_em    TIMESTAMPTZ,
  conteudo        TEXT,
  resultado       TEXT,
  tentativas      INTEGER     NOT NULL DEFAULT 0,
  max_tentativas  INTEGER     NOT NULL DEFAULT 3,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_company     ON ai_tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_scheduled   ON ai_tasks(agendado_para) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_ai_tasks_lead        ON ai_tasks(lead_id);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_tasks"   ON ai_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_tasks"   ON ai_tasks FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 6. AI MEMORY — Memória global da IA por empresa ──────────────────

CREATE TABLE IF NOT EXISTS ai_memory (
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

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_memory"  ON ai_memory FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_memory"  ON ai_memory FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 7. DIAGNOSTIC SCORES — Diagnóstico operacional ───────────────────

CREATE TABLE IF NOT EXISTS diagnostic_scores (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data                DATE        NOT NULL DEFAULT CURRENT_DATE,
  score_aquisicao     INTEGER     DEFAULT 0,
  score_conversao     INTEGER     DEFAULT 0,
  score_automacao     INTEGER     DEFAULT 0,
  score_retencao      INTEGER     DEFAULT 0,
  score_operacional   INTEGER     DEFAULT 0,
  dependencia         TEXT        DEFAULT 'ALTA'
    CHECK (dependencia IN ('BAIXA','MEDIA','ALTA','CRITICA')),
  risco               TEXT        DEFAULT 'MEDIO',
  perda_estimada      NUMERIC     DEFAULT 0,
  potencial_crescimento NUMERIC   DEFAULT 0,
  gargalos            TEXT[]      DEFAULT '{}',
  recomendacoes       JSONB       DEFAULT '[]',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, data)
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_company ON diagnostic_scores(company_id, data DESC);
ALTER TABLE diagnostic_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_diagnostic" ON diagnostic_scores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_diagnostic" ON diagnostic_scores FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 8. SELLER EVENTS — Log de atividade do Seller Engine ─────────────

CREATE TABLE IF NOT EXISTS seller_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id     UUID        REFERENCES leads(id) ON DELETE SET NULL,
  tipo        TEXT        NOT NULL,
  canal       TEXT        DEFAULT 'whatsapp',
  conteudo    TEXT,
  resultado   TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_events_company ON seller_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_events_lead    ON seller_events(lead_id);

ALTER TABLE seller_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_seller" ON seller_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "company_own_seller" ON seller_events FOR ALL USING (
  company_id IN (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id WHERE u.auth_id = auth.uid())
);

-- ── 9. DEFAULT PIPELINE STAGES (trigger) ─────────────────────────────

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

  INSERT INTO ai_memory (company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_pipeline_stages();
