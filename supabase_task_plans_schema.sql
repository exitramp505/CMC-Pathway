-- CMC Pathway task plans
-- Run once in the Supabase SQL editor before using Task Plans.

create extension if not exists pgcrypto;

create table if not exists public.cmc_task_plan_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  stage_key text not null default 'deploy' check (stage_key in ('discover','discern','develop','deploy')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_task_plan_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cmc_task_plan_templates(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_task_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cmc_task_plan_templates(id) on delete cascade,
  section_id uuid not null references public.cmc_task_plan_sections(id) on delete cascade,
  parent_task_id uuid references public.cmc_task_plan_tasks(id) on delete cascade,
  title text not null,
  description text not null default '',
  task_type text not null default 'task' check (task_type in ('group','task','milestone')),
  position integer not null default 0,
  relative_start_days integer,
  relative_due_days integer,
  is_required boolean not null default true,
  requires_approval boolean not null default false,
  participant_editable boolean not null default true,
  default_priority integer not null default 3 check (default_priority between 1 and 5),
  resource_url text not null default '',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_task_plan_dependencies (
  task_id uuid not null references public.cmc_task_plan_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.cmc_task_plan_tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.cmc_task_plan_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cmc_task_plan_templates(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.cmc_participant_task_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.cmc_task_plan_templates(id) on delete set null,
  template_version integer not null default 1,
  title text not null,
  description text not null default '',
  stage_key text not null default 'deploy' check (stage_key in ('discover','discern','develop','deploy')),
  status text not null default 'active' check (status in ('active','completed','archived')),
  anchor_date date,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_participant_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.cmc_participant_task_plans(id) on delete cascade,
  source_task_id uuid,
  parent_task_id uuid references public.cmc_participant_plan_tasks(id) on delete cascade,
  section_title text not null,
  section_position integer not null default 0,
  title text not null,
  description text not null default '',
  task_type text not null default 'task' check (task_type in ('group','task','milestone')),
  position integer not null default 0,
  start_date date,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','pending_review','completed','not_applicable')),
  priority integer not null default 3 check (priority between 1 and 5),
  is_required boolean not null default true,
  requires_approval boolean not null default false,
  participant_editable boolean not null default true,
  resource_url text not null default '',
  tags jsonb not null default '[]'::jsonb,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_participant_plan_dependencies (
  task_id uuid not null references public.cmc_participant_plan_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.cmc_participant_plan_tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.cmc_task_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.cmc_participant_task_plans(id) on delete cascade,
  task_id uuid references public.cmc_participant_plan_tasks(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cmc_task_plan_sections_template_idx on public.cmc_task_plan_sections(template_id, position);
create index if not exists cmc_task_plan_tasks_template_idx on public.cmc_task_plan_tasks(template_id, section_id, position);
create index if not exists cmc_participant_task_plans_user_idx on public.cmc_participant_task_plans(user_id, status);
create index if not exists cmc_participant_plan_tasks_plan_idx on public.cmc_participant_plan_tasks(plan_id, section_position, position);
create index if not exists cmc_participant_plan_tasks_due_idx on public.cmc_participant_plan_tasks(plan_id, due_date) where status <> 'completed';

alter table public.cmc_task_plan_templates enable row level security;
alter table public.cmc_task_plan_sections enable row level security;
alter table public.cmc_task_plan_tasks enable row level security;
alter table public.cmc_task_plan_dependencies enable row level security;
alter table public.cmc_task_plan_template_versions enable row level security;
alter table public.cmc_participant_task_plans enable row level security;
alter table public.cmc_participant_plan_tasks enable row level security;
alter table public.cmc_participant_plan_dependencies enable row level security;
alter table public.cmc_task_plan_events enable row level security;

-- Netlify Functions use the service role. These read policies allow participants
-- to read only their own plans if a future client-side view needs them.
drop policy if exists "Participants read their task plans" on public.cmc_participant_task_plans;
create policy "Participants read their task plans" on public.cmc_participant_task_plans
  for select using (auth.uid() = user_id);

drop policy if exists "Participants read their task plan tasks" on public.cmc_participant_plan_tasks;
create policy "Participants read their task plan tasks" on public.cmc_participant_plan_tasks
  for select using (exists (
    select 1 from public.cmc_participant_task_plans p
    where p.id = plan_id and p.user_id = auth.uid()
  ));
