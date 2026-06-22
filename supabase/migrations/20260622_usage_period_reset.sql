-- ─── company_usage: reset mensal real via chave (company_id, period_start) ──
-- Hoje company_id é UNIQUE isolado — uma única linha por empresa, que acumula
-- para sempre. increment_usage() faz UPSERT em ON CONFLICT (company_id), então
-- nunca cria uma linha nova por período. Esta migration muda a chave para
-- (company_id, period_start), fazendo cada mês virar uma linha nova com os
-- contadores zerados.
--
-- Efeito sobre dados existentes: as linhas atuais têm period_start = o mês em
-- que a empresa foi criada (default antigo), não o mês corrente. Esta migration
-- também atualiza period_start das linhas existentes para o mês corrente — ou
-- seja, o total acumulado até hoje passa a contar como "uso do mês atual" (não
-- há como reconstruir retroativamente quanto foi consumido em cada mês
-- passado). A partir do próximo mês, increment_usage() cria uma linha nova com
-- todos os contadores em 0.

-- 1. Trocar a UNIQUE constraint de company_id isolado para (company_id, period_start).
--    Descoberta dinâmica do nome real da constraint (não assume a convenção
--    padrão do Postgres, caso ela já tenha sido renomeada manualmente).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'company_usage'
    AND con.contype = 'u'
    AND con.conkey = (
      SELECT array_agg(attnum ORDER BY attnum)
      FROM pg_attribute
      WHERE attrelid = rel.oid AND attname = 'company_id'
    )
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE company_usage DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE company_usage DROP CONSTRAINT IF EXISTS company_usage_company_period_key;
ALTER TABLE company_usage ADD CONSTRAINT company_usage_company_period_key UNIQUE (company_id, period_start);

-- 2. Normalizar period_start das linhas existentes para o mês corrente
UPDATE company_usage SET period_start = date_trunc('month', now())::date
WHERE period_start <> date_trunc('month', now())::date;

-- 3. increment_usage() agora cria uma linha nova por (company_id, período) em
--    vez de reaproveitar a linha antiga — efetivamente zera o contador todo mês.
CREATE OR REPLACE FUNCTION increment_usage(
  p_company_id uuid,
  p_field      text,
  p_amount     integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO company_usage(company_id, period_start)
    VALUES (p_company_id, v_period)
  ON CONFLICT (company_id, period_start) DO NOTHING;

  EXECUTE format(
    'UPDATE company_usage SET %I = %I + $1, updated_at = now() WHERE company_id = $2 AND period_start = $3',
    p_field, p_field
  ) USING p_amount, p_company_id, v_period;
END;
$$;

-- 4. ensure_company_usage() (trigger em INSERT de companies) precisa do mesmo
--    ON CONFLICT novo — o antigo (company_id) sozinho não existe mais.
CREATE OR REPLACE FUNCTION ensure_company_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO company_usage(company_id, period_start)
    VALUES (NEW.id, date_trunc('month', now())::date)
  ON CONFLICT (company_id, period_start) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Novo contador para execuções de Flow Engine (flows/run, growth-maps/execute)
ALTER TABLE company_usage ADD COLUMN IF NOT EXISTS flow_executions_count integer NOT NULL DEFAULT 0;
