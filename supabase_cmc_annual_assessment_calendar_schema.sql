-- Native annual regional CMC systems assessments (one report per director per year).
-- Read/write only through authenticated Netlify Functions, not directly by browser clients.
create table if not exists public.cmc_regional_assessments (
 id uuid primary key default gen_random_uuid(),
 director_id uuid not null,
 director_name text not null,
 region text not null check (region in ('Central','East','Mountain Plains','Pacific','Southeast')),
 reporting_year integer not null check (reporting_year between 2020 and 2100),
 form_version integer not null default 1,
 status text not null default 'draft' check (status in ('draft','submitted')),
 answers jsonb not null default '{}'::jsonb,
 scores jsonb not null default '{}'::jsonb,
 reflections jsonb not null default '{}'::jsonb,
 submitted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cmc_regional_assessment_director_year_unique unique (director_id,reporting_year),
 constraint cmc_regional_assessment_submission_time check
   ((status = 'draft' and submitted_at is null) or (status = 'submitted' and submitted_at is not null))
);
create index if not exists cmc_regional_assessments_year_region
 on public.cmc_regional_assessments(reporting_year,region,status);
create index if not exists cmc_regional_assessments_director
 on public.cmc_regional_assessments(director_id,reporting_year desc);

create table if not exists public.cmc_national_calendar_settings (
 id text primary key default 'national' check (id = 'national'),
 label text not null default 'Open Bible CMC Leadership',
 secret_ical_url text,
 updated_by uuid,
 updated_at timestamptz not null default now()
);

alter table public.cmc_regional_assessments enable row level security;
revoke all on public.cmc_regional_assessments from anon,authenticated;
grant select,insert,update,delete on public.cmc_regional_assessments to service_role;
alter table public.cmc_national_calendar_settings enable row level security;
revoke all on public.cmc_national_calendar_settings from anon,authenticated;
grant select,insert,update,delete on public.cmc_national_calendar_settings to service_role;
