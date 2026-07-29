-- Participant dashboard management
-- Run after supabase_cmc_pathway_schema.sql.

alter table public.candidate_profiles
  add column if not exists current_stage text not null default 'discover',
  add column if not exists stage_updated_at timestamptz;

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_current_stage_check;

alter table public.candidate_profiles
  add constraint candidate_profiles_current_stage_check
  check (current_stage in ('discover', 'discern', 'develop', 'deploy'));

update public.candidate_profiles profile
set current_stage = coalesce(
  (
    select assignment.stage_key
    from public.candidate_assignments assignment
    where assignment.user_id = profile.id
      and assignment.status = 'assigned'
      and assignment.stage_key in ('discover', 'discern', 'develop', 'deploy')
    order by case assignment.stage_key
      when 'deploy' then 4
      when 'develop' then 3
      when 'discern' then 2
      else 1
    end desc
    limit 1
  ),
  'discover'
)
where profile.account_role = 'participant'
  and (profile.current_stage is null or profile.current_stage = 'discover');

create index if not exists candidate_profiles_current_stage_idx
  on public.candidate_profiles(current_stage);
