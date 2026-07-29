-- CMC Pathway course stage and availability settings
-- Run once after supabase_courses_schema.sql.

alter table public.cmc_courses
  add column if not exists stage_key text not null default 'discover',
  add column if not exists access_mode text not null default 'assigned';

alter table public.cmc_courses
  drop constraint if exists cmc_courses_stage_key_check,
  drop constraint if exists cmc_courses_access_mode_check;

alter table public.cmc_courses
  add constraint cmc_courses_stage_key_check
    check (stage_key in ('discover', 'discern', 'develop', 'deploy')),
  add constraint cmc_courses_access_mode_check
    check (access_mode in ('automatic', 'assigned'));

update public.cmc_courses
set stage_key = 'discover',
    access_mode = 'automatic'
where slug = 'discover';

create index if not exists cmc_courses_stage_key_idx
  on public.cmc_courses(stage_key);

create index if not exists cmc_courses_access_mode_status_idx
  on public.cmc_courses(access_mode, status);

alter table public.candidate_assignments
  add column if not exists assignment_source text not null default 'leader';

alter table public.candidate_assignments
  drop constraint if exists candidate_assignments_assignment_source_check;

alter table public.candidate_assignments
  add constraint candidate_assignments_assignment_source_check
    check (assignment_source in ('automatic', 'leader'));

update public.candidate_assignments
set assignment_source = 'automatic'
where item_key = 'discover_course';
