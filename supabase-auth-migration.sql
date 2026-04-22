-- ═══════════════════════════════════════════════════════════
-- NEXUS — Auth + Persistence Migration
-- Rodar no Supabase SQL Editor (Settings → SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- 1. Adiciona coluna auth_id na tabela users (liga ao Supabase Auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- 2. Adiciona user_id nas tabelas que ainda não têm
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE actions       ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE alerts        ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE diagnostics   ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. Trigger: quando Supabase Auth cria um usuário → cria/atualiza users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, auth_id, email, name, plan, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'free',
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_id    = NEW.id,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 4. RLS — habilitar nas tabelas principais
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics   ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas se existirem
DROP POLICY IF EXISTS "users_self"           ON users;
DROP POLICY IF EXISTS "companies_owner"      ON companies;
DROP POLICY IF EXISTS "financial_data_owner" ON financial_data;
DROP POLICY IF EXISTS "actions_owner"        ON actions;
DROP POLICY IF EXISTS "alerts_owner"         ON alerts;
DROP POLICY IF EXISTS "diagnostics_owner"    ON diagnostics;

-- Usuário vê só os próprios dados
CREATE POLICY "users_self" ON users
  FOR ALL USING (auth_id = auth.uid());

CREATE POLICY "companies_owner" ON companies
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "financial_data_owner" ON financial_data
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "actions_owner" ON actions
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "alerts_owner" ON alerts
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "diagnostics_owner" ON diagnostics
  FOR ALL USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- 5. View conveniente: company_id do usuário logado
CREATE OR REPLACE VIEW my_company AS
  SELECT c.*
  FROM companies c
  JOIN users u ON u.id = c.user_id
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

-- ═══════════════════════════════════════════════════════════
-- PRONTO. Verifique o trigger em Database → Triggers
-- ═══════════════════════════════════════════════════════════
