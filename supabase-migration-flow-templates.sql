-- Flow Templates — Marketplace for shareable automation flows
-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS flow_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  category     TEXT        NOT NULL DEFAULT 'general'
                           CHECK (category IN ('sales','retention','recovery','reactivation','upsell','onboarding','general')),
  nodes        JSONB       NOT NULL DEFAULT '[]',
  edges        JSONB       NOT NULL DEFAULT '[]',
  created_by   UUID        REFERENCES companies(id) ON DELETE SET NULL,
  is_public    BOOLEAN     NOT NULL DEFAULT true,
  price        NUMERIC(10,2) DEFAULT NULL,
  usage_count  INTEGER     NOT NULL DEFAULT 0,
  rating       NUMERIC(3,1) DEFAULT NULL,
  rating_count INTEGER     NOT NULL DEFAULT 0,
  tier         TEXT        NOT NULL DEFAULT 'free'
                           CHECK (tier IN ('free','premium','enterprise')),
  icon         TEXT        NOT NULL DEFAULT '🤖',
  color        TEXT        NOT NULL DEFAULT 'violet',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON flow_templates;
CREATE POLICY "service_role_bypass" ON flow_templates
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read" ON flow_templates;
CREATE POLICY "public_read" ON flow_templates
  FOR SELECT USING (is_public = true);

CREATE INDEX IF NOT EXISTS idx_flow_templates_category  ON flow_templates(category);
CREATE INDEX IF NOT EXISTS idx_flow_templates_tier      ON flow_templates(tier);
CREATE INDEX IF NOT EXISTS idx_flow_templates_public    ON flow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_flow_templates_usage     ON flow_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_flow_templates_created   ON flow_templates(created_at DESC);

-- ─── Seed: Built-in templates ────────────────────────────────────────────────

INSERT INTO flow_templates (name, description, category, icon, color, tier, is_public, nodes, edges) VALUES

('Recuperar Inadimplentes',
 'Identifica clientes em atraso e dispara email de cobrança inteligente com mensagem personalizada por IA.',
 'recovery', '💸', 'red', 'free', true,
 '[{"id":"n1","type":"data_analysis","position":{"x":50,"y":200},"data":{"label":"Clientes Inadimplentes","config":{"dataSource":"overdue"}}},{"id":"n2","type":"opportunity","position":{"x":320,"y":200},"data":{"label":"Detectar Oportunidade","config":{"focus":"recuperação de receita"}}},{"id":"n3","type":"message_gen","position":{"x":590,"y":200},"data":{"label":"Gerar Mensagem","config":{"messageType":"recovery","channel":"email"}}},{"id":"n4","type":"auto_action","position":{"x":860,"y":200},"data":{"label":"Enviar Email","config":{"channel":"email","segment":"overdue"}}},{"id":"n5","type":"result","position":{"x":1130,"y":200},"data":{"label":"Resultado","config":{}}}]',
 '[{"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}]'),

('Aumentar Receita Média',
 'Analisa clientes com potencial de upsell e envia proposta personalizada para upgrade de plano.',
 'upsell', '📈', 'emerald', 'free', true,
 '[{"id":"n1","type":"data_analysis","position":{"x":50,"y":200},"data":{"label":"Análise Financeira","config":{"dataSource":"financial"}}},{"id":"n2","type":"decision","position":{"x":320,"y":200},"data":{"label":"Oportunidade de Upsell?","config":{"question":"há clientes com potencial para upgrade de plano?"}}},{"id":"n3","type":"message_gen","position":{"x":590,"y":200},"data":{"label":"Proposta Personalizada","config":{"messageType":"upsell","channel":"email"}}},{"id":"n4","type":"auto_action","position":{"x":860,"y":200},"data":{"label":"Enviar Proposta","config":{"channel":"email","segment":"all"}}},{"id":"n5","type":"result","position":{"x":1130,"y":200},"data":{"label":"Resultado","config":{}}}]',
 '[{"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}]'),

('Reativar Clientes Inativos',
 'Detecta clientes sem atividade e envia campanha de reengajamento via WhatsApp.',
 'reactivation', '🔄', 'blue', 'free', true,
 '[{"id":"n1","type":"data_analysis","position":{"x":50,"y":200},"data":{"label":"Clientes Inativos","config":{"dataSource":"inactive"}}},{"id":"n2","type":"opportunity","position":{"x":320,"y":200},"data":{"label":"Identificar Potencial","config":{"focus":"reativação de clientes"}}},{"id":"n3","type":"message_gen","position":{"x":590,"y":200},"data":{"label":"Mensagem de Reativação","config":{"messageType":"reactivation","channel":"whatsapp"}}},{"id":"n4","type":"auto_action","position":{"x":860,"y":200},"data":{"label":"Enviar WhatsApp","config":{"channel":"whatsapp","segment":"inactive"}}},{"id":"n5","type":"result","position":{"x":1130,"y":200},"data":{"label":"Resultado","config":{}}}]',
 '[{"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"}]'),

('Campanha Completa de Crescimento',
 'Fluxo completo: analisa base, detecta oportunidades, decide estratégia e executa multicanal.',
 'sales', '🚀', 'violet', 'premium', true,
 '[{"id":"n1","type":"data_analysis","position":{"x":50,"y":200},"data":{"label":"Análise Completa","config":{"dataSource":"all_clients"}}},{"id":"n2","type":"opportunity","position":{"x":280,"y":200},"data":{"label":"Oportunidades IA","config":{"focus":"crescimento"}}},{"id":"n3","type":"decision","position":{"x":510,"y":200},"data":{"label":"Melhor Estratégia","config":{"question":"qual estratégia tem maior ROI?"}}},{"id":"n4","type":"message_gen","position":{"x":740,"y":200},"data":{"label":"Gerar Mensagem","config":{"messageType":"campaign","tone":"persuasivo"}}},{"id":"n5","type":"auto_action","position":{"x":970,"y":200},"data":{"label":"Executar Campanha","config":{"channel":"email","segment":"all"}}},{"id":"n6","type":"result","position":{"x":1200,"y":200},"data":{"label":"Resultado Final","config":{"metrics":["revenue","reach","conversion"]}}}]',
 '[{"id":"e1","source":"n1","target":"n2"},{"id":"e2","source":"n2","target":"n3"},{"id":"e3","source":"n3","target":"n4"},{"id":"e4","source":"n4","target":"n5"},{"id":"e5","source":"n5","target":"n6"}]');

-- Feedback table for template ratings
CREATE TABLE IF NOT EXISTS flow_template_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES flow_templates(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, company_id)
);

ALTER TABLE flow_template_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON flow_template_ratings
  TO service_role USING (true) WITH CHECK (true);
