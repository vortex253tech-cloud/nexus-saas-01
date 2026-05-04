-- ──────────────────────────────────────────────────────────────────────────────
-- NEXUS SALES AUTOMATION ENGINE — Database Migration
-- Run this in Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. leads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID        NOT NULL,
  name        TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  source      TEXT        NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('whatsapp','instagram','site','manual','other')),
  status      TEXT        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','qualified','proposal','won','lost','nurture')),
  score       INTEGER     NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  notes       TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_company   ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score     ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created   ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_leads" ON public.leads FOR ALL TO service_role USING (true);

-- ── 2. sales_conversations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_conversations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sconv_lead    ON public.sales_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_sconv_company ON public.sales_conversations(company_id);

ALTER TABLE public.sales_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_sconv" ON public.sales_conversations FOR ALL TO service_role USING (true);

-- ── 3. sales_messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_messages (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID        NOT NULL REFERENCES public.sales_conversations(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL CHECK (role IN ('lead','ai','human')),
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_smsg_conversation ON public.sales_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_smsg_created      ON public.sales_messages(created_at);

ALTER TABLE public.sales_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_smsg" ON public.sales_messages FOR ALL TO service_role USING (true);

-- ── 4. sales_actions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_actions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('offer','followup','payment','recovery','automation','message')),
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','failed')),
  payload     JSONB       DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,
  executed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sact_lead      ON public.sales_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_sact_company   ON public.sales_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_sact_type      ON public.sales_actions(type);
CREATE INDEX IF NOT EXISTS idx_sact_status    ON public.sales_actions(status);
CREATE INDEX IF NOT EXISTS idx_sact_scheduled ON public.sales_actions(scheduled_for) WHERE status = 'pending';

ALTER TABLE public.sales_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_sact" ON public.sales_actions FOR ALL TO service_role USING (true);

-- ── 5. Auto-update updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_leads_updated_at     ON public.leads;
DROP TRIGGER IF EXISTS trg_sconv_updated_at     ON public.sales_conversations;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER trg_sconv_updated_at
  BEFORE UPDATE ON public.sales_conversations
  FOR EACH ROW EXECUTE FUNCTION update_sales_updated_at();

-- Auto-update conversation updated_at when messages are inserted
CREATE OR REPLACE FUNCTION update_sconv_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.sales_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sconv_msg ON public.sales_messages;
CREATE TRIGGER trg_sconv_msg
  AFTER INSERT ON public.sales_messages
  FOR EACH ROW EXECUTE FUNCTION update_sconv_on_message();
