-- Ephemeral PostgreSQL integration-test fixtures. NEVER run on production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.cmc_courses (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null,
 subtitle text not null default '',
 description text not null default '',
 status text not null default 'draft' check (status in ('draft','published')),
 stage_key text not null default 'discover' check (stage_key in ('discover','discern','develop','deploy')),
 access_mode text not null default 'assigned' check (access_mode in ('automatic','assigned')),
 navigation_mode text not null default 'open' check (navigation_mode in ('guided','open')),
 estimated_minutes integer not null default 0,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz
);
create table public.cmc_course_modules (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.cmc_courses(id) on delete cascade,
 title text not null,
 description text not null default '',
 position integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.cmc_course_lessons (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.cmc_courses(id) on delete cascade,
 module_id uuid not null references public.cmc_course_modules(id) on delete cascade,
 title text not null, summary text not null default '',
 content text not null default '',
 lesson_type text not null default 'article' check (lesson_type in ('article','video','reflection','resource')),
 video_url text not null default '',image_url text not null default '',image_alt text not null default '',
 resource_url text not null default '',resource_label text not null default '',reflection_prompt text not null default '',
 response_required boolean not null default false,estimated_minutes integer not null default 0,
 is_required boolean not null default true,position integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.cmc_course_enrollments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 course_id uuid not null references public.cmc_courses(id) on delete cascade,
 progress integer not null default 0,
 started_at timestamptz not null default now(),
 last_opened_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(user_id,course_id)
);
create table public.cmc_course_lesson_progress (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 course_id uuid not null references public.cmc_courses(id) on delete cascade,
 lesson_id uuid not null references public.cmc_course_lessons(id) on delete cascade,
 completed boolean not null default false
);
create table public.cmc_course_lesson_responses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null, course_id uuid not null references public.cmc_courses(id) on delete cascade,
 lesson_id uuid not null references public.cmc_course_lessons(id) on delete cascade,
 response_text text not null default ''
);
create table public.candidate_profiles (
 id uuid primary key, email text, full_name text,
 account_role text not null default 'participant',
 archived_at timestamptz
);
create table public.candidate_assignments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 candidate_email text, candidate_name text,
 item_key text not null,item_type text not null default 'course',
 stage_key text, status text not null default 'assigned',
 assignment_source text not null default 'leader',
 assigned_at timestamptz,hidden_at timestamptz,updated_at timestamptz,
 unique(user_id,item_key)
);
