-- CMC Pathway coaching integration
-- Apply after supabase_cmc_pathway_schema.sql and supabase_task_plans_schema.sql.

alter table public.candidate_profiles
  add column if not exists is_coach boolean not null default false;

create or replace function public.protect_cmc_access_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if session_user <> 'postgres'
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.account_role := 'participant';
      new.is_coach := false;
    elsif new.account_role is distinct from old.account_role
       or new.is_coach is distinct from old.is_coach then
      raise exception 'Only an authorized CMC leader can change access roles.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_cmc_account_role_trigger on public.candidate_profiles;
drop trigger if exists protect_cmc_access_fields_trigger on public.candidate_profiles;
create trigger protect_cmc_access_fields_trigger
before insert or update on public.candidate_profiles
for each row execute function public.protect_cmc_access_fields();

create table if not exists public.cmc_coach_regions (
  coach_id uuid not null references public.candidate_profiles(id) on delete cascade,
  region text not null check (region in ('Central','East','Mountain Plains','Pacific','Southeast')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (coach_id, region)
);

create table if not exists public.cmc_coach_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.candidate_profiles(id) on delete restrict,
  participant_id uuid not null references public.candidate_profiles(id) on delete restrict,
  region text not null check (region in ('Central','East','Mountain Plains','Pacific','Southeast')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  check (coach_id <> participant_id),
  check ((ended_at is null and ended_by is null) or ended_at is not null)
);

create index if not exists cmc_coach_regions_region_idx
  on public.cmc_coach_regions(region, coach_id);
create index if not exists cmc_coach_assignments_coach_active_idx
  on public.cmc_coach_assignments(coach_id, participant_id) where ended_at is null;
create index if not exists cmc_coach_assignments_region_active_idx
  on public.cmc_coach_assignments(region, participant_id) where ended_at is null;
create unique index if not exists cmc_coach_assignments_one_active_participant_idx
  on public.cmc_coach_assignments(participant_id) where ended_at is null;

alter table public.cmc_coach_regions enable row level security;
alter table public.cmc_coach_assignments enable row level security;

-- Coaching records are deliberately server-only. Authenticated browser clients
-- read them through Netlify Functions after role and assignment checks.
revoke all on table public.cmc_coach_regions from anon, authenticated;
revoke all on table public.cmc_coach_assignments from anon, authenticated;
grant select, insert, update, delete on table public.cmc_coach_regions to service_role;
grant select, insert, update, delete on table public.cmc_coach_assignments to service_role;

create index if not exists candidate_profiles_is_coach_idx
  on public.candidate_profiles(is_coach) where is_coach = true;

