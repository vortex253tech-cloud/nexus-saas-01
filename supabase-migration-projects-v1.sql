-- ─── Migration: Smart Projects module ────────────────────────────────────────
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- 1. projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  type        TEXT        NOT NULL DEFAULT 'product'
    CHECK (type IN ('product', 'service', 'ecommerce', 'saas', 'other')),
  description TEXT        NOT NULL DEFAULT '',
  goal        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON projects;
CREATE POLICY "service_role_bypass" ON projects FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects (company_id);

-- 2. products
CREATE TABLE IF NOT EXISTS project_products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  price       NUMERIC     NOT NULL DEFAULT 0,
  cost        NUMERIC     NOT NULL DEFAULT 0,
  margin      NUMERIC     GENERATED ALWAYS AS (
                CASE WHEN price > 0 THEN ROUND(((price - cost) / price) * 100, 2) ELSE 0 END
              ) STORED,
  status      TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'discontinued')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON project_products;
CREATE POLICY "service_role_bypass" ON project_products FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_project_products_project ON project_products (project_id);
CREATE INDEX IF NOT EXISTS idx_project_products_company ON project_products (company_id);

-- 3. revenues
CREATE TABLE IF NOT EXISTS project_revenues (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  value       NUMERIC     NOT NULL DEFAULT 0,
  source      TEXT        NOT NULL DEFAULT 'other'
    CHECK (source IN ('sale', 'subscription', 'service', 'affiliate', 'other')),
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON project_revenues;
CREATE POLICY "service_role_bypass" ON project_revenues FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_project_revenues_project ON project_revenues (project_id);

-- 4. expenses
CREATE TABLE IF NOT EXISTS project_expenses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  value       NUMERIC     NOT NULL DEFAULT 0,
  category    TEXT        NOT NULL DEFAULT 'other'
    CHECK (category IN ('marketing', 'operational', 'personnel', 'technology', 'other')),
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON project_expenses;
CREATE POLICY "service_role_bypass" ON project_expenses FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses (project_id);

-- 5. ai_analyses (cache AI results per project)
CREATE TABLE IF NOT EXISTS project_analyses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insights    JSONB       NOT NULL DEFAULT '[]',
  alerts      JSONB       NOT NULL DEFAULT '[]',
  opportunities JSONB     NOT NULL DEFAULT '[]',
  summary     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON project_analyses;
CREATE POLICY "service_role_bypass" ON project_analyses FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_project_analyses_project ON project_analyses (project_id, created_at DESC);
