-- user_payment_config
-- Stores each tenant's payment provider credentials.
-- The platform (NEXUS) credentials are NEVER used to generate tenant payment links.

create table if not exists user_payment_config (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,

  -- Which provider is active for this tenant
  provider    text not null check (provider in ('stripe', 'mercadopago', 'pix', 'manual')),
  is_active   boolean not null default true,

  -- Stripe (tenant's own account)
  stripe_secret_key      text,
  stripe_publishable_key text,
  stripe_webhook_secret  text,

  -- Mercado Pago
  mp_access_token        text,
  mp_public_key          text,

  -- Pix (key + holder info for QR/copia-e-cola generation)
  pix_key                text,
  pix_key_type           text check (pix_key_type in ('cpf','cnpj','email','telefone','aleatoria')),
  pix_holder_name        text,
  pix_city               text,

  -- Metadata
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One config per provider per company
  unique (company_id, provider)
);

-- Index for the hot path: load active config for a company
create index if not exists idx_user_payment_config_company_active
  on user_payment_config (company_id, is_active);

-- RLS: companies can only see/edit their own config
alter table user_payment_config enable row level security;

create policy "tenant_payment_config_select"
  on user_payment_config for select
  using (company_id = (select company_id from users where id = auth.uid() limit 1));

create policy "tenant_payment_config_insert"
  on user_payment_config for insert
  with check (company_id = (select company_id from users where id = auth.uid() limit 1));

create policy "tenant_payment_config_update"
  on user_payment_config for update
  using (company_id = (select company_id from users where id = auth.uid() limit 1));

create policy "tenant_payment_config_delete"
  on user_payment_config for delete
  using (company_id = (select company_id from users where id = auth.uid() limit 1));
