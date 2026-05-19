-- NEXUS Core Engine: nexus_events table
-- Central event store for the unified operating system.
-- Supabase Realtime publishes INSERT events to subscribed clients.

create table if not exists public.nexus_events (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  company_id   uuid references public.companies(id) on delete cascade,
  payload      jsonb not null default '{}',
  source       text not null default 'system',
  created_at   timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists nexus_events_company_id_idx    on public.nexus_events (company_id);
create index if not exists nexus_events_type_idx          on public.nexus_events (type);
create index if not exists nexus_events_created_at_idx    on public.nexus_events (created_at desc);
create index if not exists nexus_events_company_type_idx  on public.nexus_events (company_id, type, created_at desc);

-- RLS: companies can only see their own events
alter table public.nexus_events enable row level security;

create policy "service_role_all" on public.nexus_events
  for all using (true)
  with check (true);

-- Enable Realtime for this table (allows SUBSCRIBE)
alter publication supabase_realtime add table public.nexus_events;

-- Auto-prune: keep only 7 days of events (run nightly via pg_cron if available)
-- Manual cleanup: DELETE FROM nexus_events WHERE created_at < now() - interval '7 days';
