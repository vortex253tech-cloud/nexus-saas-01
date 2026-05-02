-- ─── Leads table ─────────────────────────────────────────────────────────────
-- Stores CRM leads captured manually, imported, or created by automations.
-- Separate from onboarding_leads (which is the public signup wizard).

create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  source      text default 'manual',   -- manual | import | flow | webhook
  notes       text,
  status      text not null default 'new'
                check (status in ('new', 'contacted', 'converted', 'lost')),
  converted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- indexes
create index if not exists leads_company_id_idx    on leads (company_id);
create index if not exists leads_status_idx        on leads (company_id, status);
create index if not exists leads_created_at_idx    on leads (company_id, created_at desc);

-- RLS
alter table leads enable row level security;

create policy "leads_company_isolation"
  on leads for all
  using (company_id = (
    select company_id from profiles
    where id = auth.uid()
    limit 1
  ));

-- auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();
