-- Migration v9: Analytics events + subscriptions
-- Strategy: DROP + CREATE to ensure clean state (tables may be partially created)
-- RLS pattern follows proven pattern from 20240005_apply_all.sql (uuid=uuid in WHERE)

-- ── Tear down any partial state from previous runs ───────────────────────────
drop table if exists public.subscriptions   cascade;
drop table if exists public.analytics_events cascade;

-- ── analytics_events ─────────────────────────────────────────────────────────
-- company_id / user_id stored as TEXT because the app passes users.id as string
create table public.analytics_events (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  company_id  text        not null,
  user_id     text,
  plan        text,
  value       numeric,
  properties  jsonb,
  created_at  timestamptz not null default now()
);

create index analytics_events_company_id_idx on public.analytics_events (company_id);
create index analytics_events_name_idx        on public.analytics_events (name);
create index analytics_events_created_at_idx  on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

-- service_role can insert freely (webhook + server routes use service key)
create policy "service_insert_analytics" on public.analytics_events
  for insert to service_role with check (true);

-- Users can only read events from their own company
-- Pattern: JOIN users+companies (all UUID columns) — only cast at SELECT output
create policy "user_read_analytics" on public.analytics_events
  for select using (
    company_id = (
      select c.id::text
      from   public.companies c
      join   public.users    u on u.id = c.user_id
      where  u.auth_id = auth.uid()
      limit  1
    )
  );

-- ── subscriptions ─────────────────────────────────────────────────────────────
-- user_id stored as TEXT (mirrors users.id string passed by Stripe webhook)
create table public.subscriptions (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 text        not null unique,
  plan                    text        not null default 'free',
  status                  text        not null default 'active',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index subscriptions_user_id_idx         on public.subscriptions (user_id);
create index subscriptions_stripe_sub_id_idx   on public.subscriptions (stripe_subscription_id);
create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- service_role full access (Stripe webhook uses service key)
create policy "service_all_subscriptions" on public.subscriptions
  for all to service_role using (true) with check (true);

-- User reads only their own subscription
-- uuid comparison in WHERE; only cast at SELECT output
create policy "user_read_own_subscription" on public.subscriptions
  for select using (
    user_id = (
      select id::text
      from   public.users
      where  auth_id = auth.uid()
      limit  1
    )
  );

-- ── users: add plan column if missing ────────────────────────────────────────
alter table public.users
  add column if not exists plan text not null default 'free';

-- ── companies: add autopilot columns if missing ───────────────────────────────
alter table public.companies
  add column if not exists approval_mode       text    not null default 'auto',
  add column if not exists max_actions_per_day integer not null default 20;
