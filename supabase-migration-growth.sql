-- ──────────────────────────────────────────────────────────────────────────────
-- NEXUS GROWTH & SALES SCALING ENGINE — Database Migration
-- Run AFTER supabase-migration-sales.sql
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend leads table with growth tracking ───────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source      TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium      TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign    TEXT,
  ADD COLUMN IF NOT EXISTS utm_content     TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id     TEXT,
  ADD COLUMN IF NOT EXISTS ad_set_id       TEXT,
  ADD COLUMN IF NOT EXISTS ad_id           TEXT,
  ADD COLUMN IF NOT EXISTS ip_address      TEXT,
  ADD COLUMN IF NOT EXISTS referrer        TEXT,
  ADD COLUMN IF NOT EXISTS first_message   TEXT,
  ADD COLUMN IF NOT EXISTS intent_score    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_stage  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revenue         NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_followup ON public.leads(followup_stage, last_followup_at)
  WHERE status NOT IN ('won','lost');
CREATE INDEX IF NOT EXISTS idx_leads_source_status ON public.leads(source, status);
CREATE INDEX IF NOT EXISTS idx_leads_created_date  ON public.leads((created_at::date));

-- ── 2. Campaigns table (Meta Ads, Google, organic) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID          NOT NULL,
  name          TEXT          NOT NULL,
  platform      TEXT          NOT NULL DEFAULT 'meta'
                              CHECK (platform IN ('meta','google','tiktok','organic','manual','other')),
  external_id   TEXT,
  status        TEXT          NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','ended')),
  daily_budget  NUMERIC(12,2),
  total_spend   NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions   INTEGER       NOT NULL DEFAULT 0,
  clicks        INTEGER       NOT NULL DEFAULT 0,
  leads_count   INTEGER       NOT NULL DEFAULT 0,
  conversions   INTEGER       NOT NULL DEFAULT 0,
  revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata      JSONB         DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ   DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company  ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON public.campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status   ON public.campaigns(status);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_campaigns" ON public.campaigns FOR ALL TO service_role USING (true);

-- ── 3. Analytics events (funnel tracking) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID          NOT NULL,
  lead_id      UUID          REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id  UUID          REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event_type   TEXT          NOT NULL,
  -- lead_captured | message_sent | offer_generated | payment_initiated
  -- payment_completed | followup_sent | auto_reply_sent | conversion
  channel      TEXT,
  -- whatsapp | instagram | site | manual | other
  value        NUMERIC(12,2),
  metadata     JSONB         DEFAULT '{}',
  created_at   TIMESTAMPTZ   DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_company  ON public.analytics_events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_lead     ON public.analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_type     ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created  ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_channel  ON public.analytics_events(channel);
CREATE INDEX IF NOT EXISTS idx_events_date     ON public.analytics_events((created_at::date));

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_events" ON public.analytics_events FOR ALL TO service_role USING (true);

-- ── 4. Auto-update triggers for campaigns ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_sales_updated_at();

-- ── 5. Helper: daily lead + conversion aggregation (for analytics) ────────────
CREATE OR REPLACE FUNCTION get_lead_stats_by_day(
  p_company_id UUID,
  p_days       INTEGER DEFAULT 30
)
RETURNS TABLE(
  stat_date     DATE,
  leads_count   BIGINT,
  conversions   BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    created_at::date AS stat_date,
    COUNT(*)                                                AS leads_count,
    COUNT(CASE WHEN status = 'won' THEN 1 END)             AS conversions
  FROM public.leads
  WHERE company_id = p_company_id
    AND created_at >= now() - (p_days || ' days')::INTERVAL
  GROUP BY created_at::date
  ORDER BY stat_date DESC;
$$;

CREATE OR REPLACE FUNCTION get_channel_stats(p_company_id UUID)
RETURNS TABLE(
  channel         TEXT,
  leads_count     BIGINT,
  conversions     BIGINT,
  hot_count       BIGINT,
  avg_score       NUMERIC
) LANGUAGE SQL STABLE AS $$
  SELECT
    source                                                 AS channel,
    COUNT(*)                                               AS leads_count,
    COUNT(CASE WHEN status = 'won' THEN 1 END)             AS conversions,
    COUNT(CASE WHEN score >= 80 THEN 1 END)                AS hot_count,
    ROUND(AVG(score)::NUMERIC, 1)                          AS avg_score
  FROM public.leads
  WHERE company_id = p_company_id
  GROUP BY source
  ORDER BY leads_count DESC;
$$;
