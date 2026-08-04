-- Discernment Center Application module
-- Run this once in Supabase SQL Editor before testing application uploads.

create table if not exists public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  candidate_name text not null default '',
  email text not null default '',
  phone text not null default '',
  state text not null default '',
  region text not null default '',
  status text not null default 'draft',
  completion numeric not null default 0,
  application jsonb not null default '{}'::jsonb,
  photo_path text,
  photo_name text,
  resume_path text,
  resume_name text,
  submitted_at timestamptz,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopen_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_applications enable row level security;

drop policy if exists "Users can read own application" on public.candidate_applications;
create policy "Users can read own application"
on public.candidate_applications for select
using (auth.uid() = user_id);

-- Application changes are written by authenticated server functions. Keeping
-- browser write policies disabled prevents submitted records from being edited
-- around the application lock.
drop policy if exists "Users can insert own application" on public.candidate_applications;
drop policy if exists "Users can update own application" on public.candidate_applications;

create table if not exists public.candidate_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.candidate_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'reopened')),
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.candidate_application_events enable row level security;
drop policy if exists "Users can read own application events" on public.candidate_application_events;
create policy "Users can read own application events"
on public.candidate_application_events for select
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('candidate-uploads', 'candidate-uploads', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/heic','image/heif',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'candidate-uploads';

drop policy if exists "Users can upload own candidate files" on storage.objects;
create policy "Users can upload own candidate files"
on storage.objects for insert to authenticated
with check (bucket_id = 'candidate-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read own candidate files" on storage.objects;
create policy "Users can read own candidate files"
on storage.objects for select to authenticated
using (bucket_id = 'candidate-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can replace own candidate files" on storage.objects;
create policy "Users can replace own candidate files"
on storage.objects for update to authenticated
using (bucket_id = 'candidate-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'candidate-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own candidate files" on storage.objects;
create policy "Users can delete own candidate files"
on storage.objects for delete to authenticated
using (bucket_id = 'candidate-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
