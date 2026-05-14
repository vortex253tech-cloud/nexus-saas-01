-- ---------------------------------------------------------------------------------
-- NEXUS REFERRAL SYSTEM - Migration
-- Run this after supabase-migration-waitlist.sql
-- ---------------------------------------------------------------------------------

-- 1. Extend waitlist table with referral columns
alter table waitlist
  add column if not exists referral_code   text unique,
  add column if not exists referred_by     text references waitlist(referral_code),
  add column if not exists referrals_count integer not null default 0,
  add column if not exists position        integer,
  add column if not exists source          text;

-- 2. Index for fast referral code lookup
create index if not exists idx_waitlist_referral_code on waitlist(referral_code);
create index if not exists idx_waitlist_referred_by   on waitlist(referred_by);

-- 3. Assign sequential positions to existing rows (backfill)
with ranked as (
  select id, row_number() over (order by created_at asc) as rn
  from waitlist
)
update waitlist w
set position = r.rn
from ranked r
where w.id = r.id;

-- 4. Function: recalculate all positions (accounts for referral boosts)
--    Each referral moves the user up 10 positions from their base position.
--    Position cannot go below 1.
create or replace function recalculate_waitlist_positions()
returns void
language plpgsql
as $$
declare
  base_position integer;
  rec record;
begin
  for rec in
    select id, referrals_count,
           row_number() over (order by created_at asc) as base_pos
    from waitlist
  loop
    base_position := greatest(1, rec.base_pos - (rec.referrals_count * 10));
    update waitlist set position = base_position where id = rec.id;
  end loop;
end;
$$;

-- 5. Function: increment referral count and recalc positions when a referral converts
create or replace function handle_referral_signup()
returns trigger
language plpgsql
as $$
begin
  if new.referred_by is not null then
    update waitlist
    set referrals_count = referrals_count + 1
    where referral_code = new.referred_by;
  end if;
  perform recalculate_waitlist_positions();
  return new;
end;
$$;

-- 6. Trigger: runs after every new waitlist insert
drop trigger if exists trg_referral_signup on waitlist;
create trigger trg_referral_signup
  after insert on waitlist
  for each row
  execute function handle_referral_signup();
