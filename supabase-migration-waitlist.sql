-- Waitlist table for NEXUS landing page lead capture
create table if not exists waitlist (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null,
  email      text        not null unique,
  company    text        not null,
  team_size  text,
  created_at timestamptz default now()
);

alter table waitlist enable row level security;
-- No public policies — access only via service role key (API route)
