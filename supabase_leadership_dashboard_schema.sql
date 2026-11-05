-- CMC leadership home: regional meeting history and follow-up reminders.
-- Items are accessed only through authenticated Netlify functions that verify
-- the account role, region, and write permissions. Do not grant browser access.

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_account_role_check;
alter table public.candidate_profiles
  add constraint candidate_profiles_account_role_check
  check (account_role in ('participant', 'regional_leader', 'cmc_admin', 'cmc_viewer'));

create table if not exists public.cmc_leadership_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('meeting', 'task')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  region text check (region in ('Central', 'East', 'Mountain Plains', 'Pacific', 'Southeast')),
  visibility text not null default 'team' check (visibility in ('team', 'personal')),
  body text not null default '',
  notes text not null default '',
  decisions text not null default '',
  starts_at timestamptz,
  due_date date,
  meeting_id uuid references public.cmc_leadership_items(id) on delete set null,
  assigned_to uuid,
  completed_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmc_leadership_meeting_is_shared check (kind <> 'meeting' or (visibility = 'team' and starts_at is not null)),
  constraint cmc_leadership_task_has_no_start check (kind <> 'task' or starts_at is null),
  constraint cmc_leadership_meeting_has_no_parent check (kind <> 'meeting' or meeting_id is null)
);

create index if not exists cmc_leadership_items_region_idx
  on public.cmc_leadership_items(region, kind, created_at desc);
create index if not exists cmc_leadership_items_due_idx
  on public.cmc_leadership_items(due_date) where kind = 'task' and completed_at is null;
create index if not exists cmc_leadership_items_starts_idx
  on public.cmc_leadership_items(starts_at) where kind = 'meeting';
create index if not exists cmc_leadership_items_created_by_idx
  on public.cmc_leadership_items(created_by) where visibility = 'personal';

alter table public.cmc_leadership_items enable row level security;
revoke all on table public.cmc_leadership_items from anon, authenticated;
grant select, insert, update, delete on table public.cmc_leadership_items to service_role;

-- Intentionally no browser RLS policies. Server-side service-role functions
-- make per-user and per-region authorization decisions on every request.
