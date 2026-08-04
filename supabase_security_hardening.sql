-- CMC Pathway security hardening migration
-- Run once in the Supabase SQL Editor before publishing this code revision.

create or replace function public.cmc_region_for_state(state_code text)
returns text
language sql
immutable
as $$
  select case upper(trim(coalesce(state_code, '')))
    when 'WA' then 'Pacific' when 'HI' then 'Pacific' when 'AK' then 'Pacific'
    when 'AZ' then 'Pacific' when 'UT' then 'Pacific' when 'CA' then 'Pacific'
    when 'NV' then 'Pacific' when 'ID' then 'Pacific' when 'OR' then 'Pacific'
    when 'TX' then 'Central' when 'OK' then 'Central' when 'AR' then 'Central'
    when 'WI' then 'Central' when 'MN' then 'Central' when 'IA' then 'Central'
    when 'IL' then 'Central' when 'MO' then 'Central' when 'KS' then 'Central'
    when 'CO' then 'Mountain Plains' when 'WY' then 'Mountain Plains'
    when 'NE' then 'Mountain Plains' when 'SD' then 'Mountain Plains'
    when 'ND' then 'Mountain Plains' when 'MT' then 'Mountain Plains'
    when 'NH' then 'East' when 'VT' then 'East' when 'MA' then 'East'
    when 'ME' then 'East' when 'RI' then 'East' when 'CT' then 'East'
    when 'NJ' then 'East' when 'DE' then 'East' when 'MD' then 'East'
    when 'WV' then 'East' when 'PA' then 'East' when 'OH' then 'East'
    when 'VA' then 'East' when 'KY' then 'East' when 'TN' then 'East'
    when 'IN' then 'East' when 'MI' then 'East' when 'NY' then 'East'
    when 'FL' then 'Southeast' when 'GA' then 'Southeast'
    when 'AL' then 'Southeast' when 'MS' then 'Southeast'
    when 'LA' then 'Southeast' when 'SC' then 'Southeast'
    when 'NC' then 'Southeast' when 'PR' then 'Southeast'
    else null
  end
$$;

update public.candidate_profiles
set region = public.cmc_region_for_state(state)
where public.cmc_region_for_state(state) is not null
  and region is distinct from public.cmc_region_for_state(state);

update public.candidate_applications
set region = public.cmc_region_for_state(state),
    application = jsonb_set(application, '{region}', to_jsonb(public.cmc_region_for_state(state)), true)
where public.cmc_region_for_state(state) is not null
  and region is distinct from public.cmc_region_for_state(state);

create or replace function public.protect_cmc_profile_privileges()
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
      new.region := coalesce(public.cmc_region_for_state(new.state), new.region, 'Unassigned');
      new.current_stage := 'discover';
      new.archived_at := null;
      new.stage_updated_at := coalesce(new.stage_updated_at, now());
      new.email := coalesce(auth.jwt() ->> 'email', new.email, '');
    else
      new.account_role := old.account_role;
      new.region := coalesce(public.cmc_region_for_state(new.state), old.region, 'Unassigned');
      new.current_stage := old.current_stage;
      new.archived_at := old.archived_at;
      new.stage_updated_at := old.stage_updated_at;
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_cmc_account_role_trigger on public.candidate_profiles;
drop trigger if exists protect_cmc_profile_privileges_trigger on public.candidate_profiles;
create trigger protect_cmc_profile_privileges_trigger
before insert or update on public.candidate_profiles
for each row execute function public.protect_cmc_profile_privileges();

alter table public.candidate_applications
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null,
  add column if not exists reopen_reason text not null default '';

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

-- Application writes go through authenticated Netlify functions so the lock
-- and audit log cannot be bypassed with a direct browser request.
drop policy if exists "Users can insert own application" on public.candidate_applications;
drop policy if exists "Users can update own application" on public.candidate_applications;

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
with check (
  bucket_id = 'candidate-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own candidate files" on storage.objects;
create policy "Users can read own candidate files"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can replace own candidate files" on storage.objects;
create policy "Users can replace own candidate files"
on storage.objects for update to authenticated
using (
  bucket_id = 'candidate-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'candidate-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own candidate files" on storage.objects;
create policy "Users can delete own candidate files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'candidate-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create index if not exists candidate_application_events_application_idx
  on public.candidate_application_events(application_id, created_at desc);

create table if not exists public.cmc_rate_limit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.cmc_rate_limit_events enable row level security;
-- No browser policies: only service-role functions record or inspect limits.
create index if not exists cmc_rate_limit_events_lookup_idx
  on public.cmc_rate_limit_events(actor_user_id, action, created_at desc);
