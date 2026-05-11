-- ─── NEXUS Onboarding Setup Tables ───────────────────────────
-- Run in Supabase SQL Editor after deploying this migration.

-- Extended company profile (captured during onboarding)
create table if not exists company_profile (
  id              uuid        default gen_random_uuid() primary key,
  company_id      uuid        not null references companies(id) on delete cascade,
  objectives      text[]      default '{}',
  main_challenge  text,
  team_size       text,
  revenue_range   text,
  ai_personality  text        default 'moderno',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index if not exists company_profile_company_id_key on company_profile(company_id);

-- AI training files uploaded during onboarding
create table if not exists ai_training_files (
  id           uuid        default gen_random_uuid() primary key,
  company_id   uuid        not null references companies(id) on delete cascade,
  name         text        not null,
  size         bigint,
  mime_type    text,
  storage_path text,
  status       text        default 'uploaded',
  created_at   timestamptz default now()
);

-- Integration preferences (channels user wants to connect)
create table if not exists company_integrations (
  id           uuid        default gen_random_uuid() primary key,
  company_id   uuid        not null references companies(id) on delete cascade,
  provider     text        not null,
  status       text        default 'pending',
  config       jsonb       default '{}',
  connected_at timestamptz,
  created_at   timestamptz default now(),
  unique(company_id, provider)
);

-- Enable RLS on all new tables
alter table company_profile       enable row level security;
alter table ai_training_files     enable row level security;
alter table company_integrations  enable row level security;

-- Service role bypass (API routes use service role key)
-- No public policies needed — all access via service role.

-- Create Supabase Storage bucket for AI training files (run once)
-- insert into storage.buckets (id, name, public)
-- values ('ai-training', 'ai-training', false)
-- on conflict do nothing;
