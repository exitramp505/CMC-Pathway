-- CMC Pathway course system
-- Run once in the Supabase SQL Editor after the existing CMC Pathway schemas.

create table if not exists public.cmc_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  status text not null default 'draft',
  stage_key text not null default 'discover',
  access_mode text not null default 'assigned',
  estimated_minutes integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint cmc_courses_status_check check (status in ('draft', 'published')),
  constraint cmc_courses_stage_key_check check (stage_key in ('discover', 'discern', 'develop', 'deploy')),
  constraint cmc_courses_access_mode_check check (access_mode in ('automatic', 'assigned'))
);

create table if not exists public.cmc_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cmc_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cmc_courses(id) on delete cascade,
  module_id uuid not null references public.cmc_course_modules(id) on delete cascade,
  title text not null,
  summary text not null default '',
  content text not null default '',
  video_url text not null default '',
  reflection_prompt text not null default '',
  estimated_minutes integer not null default 0,
  is_required boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmc_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.cmc_courses(id) on delete cascade,
  progress integer not null default 0,
  started_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id, course_id),
  constraint cmc_course_enrollment_progress_check check (progress between 0 and 100)
);

create table if not exists public.cmc_course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.cmc_courses(id) on delete cascade,
  lesson_id uuid not null references public.cmc_course_lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create index if not exists cmc_course_modules_course_position_idx
  on public.cmc_course_modules(course_id, position);
create index if not exists cmc_course_lessons_course_module_position_idx
  on public.cmc_course_lessons(course_id, module_id, position);
create index if not exists cmc_course_enrollments_user_idx
  on public.cmc_course_enrollments(user_id);
create index if not exists cmc_course_lesson_progress_user_course_idx
  on public.cmc_course_lesson_progress(user_id, course_id);

alter table public.cmc_courses enable row level security;
alter table public.cmc_course_modules enable row level security;
alter table public.cmc_course_lessons enable row level security;
alter table public.cmc_course_enrollments enable row level security;
alter table public.cmc_course_lesson_progress enable row level security;

-- Course content and progress are served by authenticated Netlify Functions.
-- This keeps draft material and administrative writes out of the browser client.

insert into public.cmc_courses (
  slug,
  title,
  subtitle,
  description,
  status,
  stage_key,
  access_mode,
  estimated_minutes
)
values (
  'discover',
  'Discover: Church Multiplication 101',
  'A biblical introduction to church multiplication',
  'Learn the biblical foundation, shared language, and first questions of church multiplication.',
  'draft',
  'discover',
  'automatic',
  0
)
on conflict (slug) do nothing;
