-- ═══════════════════════════════════════════════════════════════
-- NEXUS — FASE 1: Módulo Financeiro
-- customers, invoices, payments
-- ═══════════════════════════════════════════════════════════════

-- ─── customers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_company  ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_email    ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone    ON customers(phone) WHERE phone IS NOT NULL;

-- ─── invoices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID        REFERENCES customers(id) ON DELETE CASCADE,
  amount      NUMERIC     NOT NULL CHECK (amount > 0),
  description TEXT,
  due_date    DATE        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_link TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company    ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date   ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_overdue    ON invoices(company_id, due_date) WHERE status = 'pending';

-- ─── payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID        REFERENCES companies(id) ON DELETE CASCADE,
  amount     NUMERIC     NOT NULL CHECK (amount > 0),
  method     TEXT        DEFAULT 'manual',
  notes      TEXT,
  paid_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company   ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at   ON payments(paid_at DESC);

-- ─── charge_logs (registro de cobranças enviadas) ──────────────
CREATE TABLE IF NOT EXISTS charge_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID        REFERENCES invoices(id) ON DELETE CASCADE,
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  channel     TEXT        NOT NULL, -- 'whatsapp' | 'email'
  status      TEXT        NOT NULL, -- 'sent' | 'failed' | 'simulated'
  message     TEXT,
  response    TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charge_logs_invoice ON charge_logs(invoice_id);

-- ─── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_full_customers"   ON customers;
DROP POLICY IF EXISTS "service_full_invoices"    ON invoices;
DROP POLICY IF EXISTS "service_full_payments"    ON payments;
DROP POLICY IF EXISTS "service_full_charge_logs" ON charge_logs;

CREATE POLICY "service_full_customers"   ON customers   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_invoices"    ON invoices    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_payments"    ON payments    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_full_charge_logs" ON charge_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Verificação ──────────────────────────────────────────────
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'invoices', 'payments', 'charge_logs')
ORDER BY tablename;
