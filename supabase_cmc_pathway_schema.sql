-- CMC Pathway expansion
-- Run after the existing Supabase portal and candidate assignment schemas.

alter table public.candidate_profiles
  add column if not exists account_role text not null default 'participant',
  add column if not exists church_name text not null default '',
  add column if not exists ministry_role text not null default '',
  add column if not exists pathway_interest text not null default '';

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_account_role_check;

alter table public.candidate_profiles
  add constraint candidate_profiles_account_role_check
  check (account_role in ('participant', 'regional_leader', 'cmc_admin'));

create or replace function public.protect_cmc_account_role()
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
    elsif new.account_role is distinct from old.account_role then
      raise exception 'Only a CMC administrator can change account roles.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_cmc_account_role_trigger on public.candidate_profiles;
create trigger protect_cmc_account_role_trigger
before insert or update on public.candidate_profiles
for each row execute function public.protect_cmc_account_role();

alter table public.candidate_assignments
  add column if not exists stage_key text,
  add column if not exists progress integer not null default 0,
  add column if not exists external_status text not null default '',
  add column if not exists external_user_id text,
  add column if not exists invitation_status text not null default '',
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists integration_error text,
  add column if not exists completed_at timestamptz;

alter table public.candidate_assignments
  drop constraint if exists candidate_assignments_progress_check;

alter table public.candidate_assignments
  add constraint candidate_assignments_progress_check
  check (progress between 0 and 100);

update public.candidate_assignments
set stage_key = case
  when item_key = 'discover_course' then 'discover'
  when item_key in (
    'discernment_application',
    'ministry_readiness',
    'ministry_style',
    'character_qualities'
  ) then 'discern'
  else stage_key
end
where stage_key is null or stage_key = '';

create index if not exists candidate_profiles_account_role_idx
  on public.candidate_profiles(account_role);

create index if not exists candidate_profiles_region_idx
  on public.candidate_profiles(region);

create index if not exists candidate_assignments_stage_key_idx
  on public.candidate_assignments(stage_key);

update public.candidate_profiles
set region = 'Southeast'
where region = 'South East';

-- Participants can continue reading only their own profile.
-- Regional and national views are served through authenticated Netlify
-- functions that verify account_role and apply the correct region filter.
