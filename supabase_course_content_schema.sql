-- Rich lesson content and participant reflections
-- Run once after supabase_courses_schema.sql.

alter table public.cmc_course_lessons
  add column if not exists lesson_type text not null default 'article',
  add column if not exists image_url text not null default '',
  add column if not exists image_alt text not null default '',
  add column if not exists resource_url text not null default '',
  add column if not exists resource_label text not null default '',
  add column if not exists response_required boolean not null default false;

alter table public.cmc_course_lessons
  drop constraint if exists cmc_course_lessons_type_check;

alter table public.cmc_course_lessons
  add constraint cmc_course_lessons_type_check
    check (lesson_type in ('article', 'video', 'reflection', 'resource'));

create table if not exists public.cmc_course_lesson_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.cmc_courses(id) on delete cascade,
  lesson_id uuid not null references public.cmc_course_lessons(id) on delete cascade,
  response_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create index if not exists cmc_course_lesson_responses_user_course_idx
  on public.cmc_course_lesson_responses(user_id, course_id);

alter table public.cmc_course_lesson_responses enable row level security;

-- Responses are read and written through authenticated Netlify Functions.
