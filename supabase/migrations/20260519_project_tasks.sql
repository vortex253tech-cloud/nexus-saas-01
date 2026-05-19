-- ─── Project Tasks & Comments ─────────────────────────────────────────────────

create table if not exists public.project_tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'todo'
                  check (status in ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  priority      text not null default 'medium'
                  check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date      date,
  assignee_name text,
  tags          text[] default '{}',
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.project_comments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.project_tasks(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  content      text not null,
  author_name  text,
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists project_tasks_project_idx  on public.project_tasks(project_id);
create index if not exists project_tasks_company_idx  on public.project_tasks(company_id);
create index if not exists project_tasks_status_idx   on public.project_tasks(status);
create index if not exists project_comments_task_idx  on public.project_comments(task_id);

-- RLS
alter table public.project_tasks    enable row level security;
alter table public.project_comments enable row level security;

create policy "service_role_tasks"    on public.project_tasks    for all to service_role using (true) with check (true);
create policy "service_role_comments" on public.project_comments for all to service_role using (true) with check (true);

-- updated_at trigger (create if not exists)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_tasks_updated_at on public.project_tasks;
create trigger project_tasks_updated_at
  before update on public.project_tasks
  for each row execute function public.set_updated_at();
