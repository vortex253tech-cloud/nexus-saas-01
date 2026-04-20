-- ─── NEXUS SaaS — Supabase Migration ────────────────────────
-- Run this in your Supabase dashboard → SQL Editor
-- Project: nexus-saas (separate from any other project)

-- ─── 1. Create onboarding_leads table ──────────────────────

create table if not exists public.onboarding_leads (
  id          uuid        primary key default gen_random_uuid(),
  nome        text,
  email       text unique,
  perfil      text check (perfil in ('ecommerce','servicos','tech','consultoria','varejo','outro')),
  respostas   jsonb       not null default '{}',
  fonte       text        not null default 'direct',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.onboarding_leads is
  'Wizard leads captured incrementally as users progress through onboarding.';

comment on column public.onboarding_leads.respostas is
  'Flexible JSON bag: answers accumulate as each wizard step completes.
   Keys: nomeEmpresa, setor, metaMensal, principalDesafio,
         stage, revenueRange, teamSize, and any future params.';

comment on column public.onboarding_leads.fonte is
  'Traffic source: direct | lovable | typeform | ads | ...';

-- ─── 2. Auto-update updated_at via trigger ──────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_leads_updated_at on public.onboarding_leads;

create trigger onboarding_leads_updated_at
  before update on public.onboarding_leads
  for each row execute procedure public.set_updated_at();

-- ─── 3. Indexes ─────────────────────────────────────────────

-- Email is already unique (implicit index), but add a btree for
-- partial lookups (e.g. anonymous leads without email)
create index if not exists idx_leads_email
  on public.onboarding_leads (email)
  where email is not null;

-- Perfil for segmentation queries
create index if not exists idx_leads_perfil
  on public.onboarding_leads (perfil)
  where perfil is not null;

-- Source for funnel analytics
create index if not exists idx_leads_fonte
  on public.onboarding_leads (fonte);

-- Time-series for volume dashboards
create index if not exists idx_leads_created_at
  on public.onboarding_leads (created_at desc);

-- ─── 4. Row Level Security ─────────────────────────────────
-- The API routes use the SERVICE_ROLE key (bypasses RLS).
-- The public anon key must NOT be able to read other leads.

alter table public.onboarding_leads enable row level security;

-- Anon/authenticated users can insert (wizard form)
create policy "leads_insert_public"
  on public.onboarding_leads
  for insert
  to anon, authenticated
  with check (true);

-- Anon/authenticated users can update ONLY their own record (by email)
-- The upsert in the API route calls with service_role, so this
-- policy is a safety net if anon key is ever used directly.
create policy "leads_update_own"
  on public.onboarding_leads
  for update
  to anon, authenticated
  using (email = current_setting('request.jwt.claims', true)::jsonb ->> 'email');

-- Service role can do everything (used by API routes)
-- No explicit policy needed — service role bypasses RLS.

-- ─── 5. Verify ──────────────────────────────────────────────
-- Run after migration to confirm setup:
select
  tablename,
  rowsecurity
from pg_tables
where tablename = 'onboarding_leads';
