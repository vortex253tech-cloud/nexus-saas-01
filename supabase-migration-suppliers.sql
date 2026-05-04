-- ─── Supplier Intelligence Module ────────────────────────────────────────────
-- Run in: Supabase → SQL Editor → New query

-- 1. suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  contact_email    TEXT,
  contact_whatsapp TEXT,
  type             TEXT NOT NULL DEFAULT 'recurring',   -- 'recurring' | 'one-time'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. supplier_costs
CREATE TABLE IF NOT EXISTS public.supplier_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL,
  frequency   TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'weekly' | 'one-time'
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. supplier_insights
CREATE TABLE IF NOT EXISTS public.supplier_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id  UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  type         TEXT NOT NULL, -- 'high_cost' | 'increase' | 'inefficiency' | 'dependency' | 'duplicate'
  message      TEXT NOT NULL,
  impact_value NUMERIC(14,2) DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_company     ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_costs_sup    ON public.supplier_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_costs_date   ON public.supplier_costs(date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_insights_co  ON public.supplier_insights(company_id);

-- RLS
ALTER TABLE public.suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_costs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_insights ENABLE ROW LEVEL SECURITY;

-- Service role bypass (existing pattern for all NEXUS tables)
CREATE POLICY "service_role_all_suppliers"         ON public.suppliers         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_supplier_costs"    ON public.supplier_costs    FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_supplier_insights" ON public.supplier_insights FOR ALL TO service_role USING (true);
