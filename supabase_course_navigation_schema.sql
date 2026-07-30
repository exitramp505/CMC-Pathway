-- Course-level lesson navigation
-- Run once in the Supabase SQL Editor before deploying the matching website code.

alter table public.cmc_courses
  add column if not exists navigation_mode text not null default 'open';

alter table public.cmc_courses
  drop constraint if exists cmc_courses_navigation_mode_check;

alter table public.cmc_courses
  add constraint cmc_courses_navigation_mode_check
  check (navigation_mode in ('guided', 'open'));

-- Discover 101 is intentionally sequential. Other existing courses remain open.
update public.cmc_courses
set navigation_mode = 'guided'
where slug = 'discover';
