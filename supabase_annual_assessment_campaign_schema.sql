-- Annual CMC regional systems assessment campaign settings and protected assignments.
-- Reporting year 2026 is assigned in February 2027, followed by each subsequent year.
create table if not exists public.cmc_annual_assessment_settings (
 id text primary key default 'national' check (id='national'),
 enabled boolean not null default true,
 first_campaign_year integer not null default 2027 check (first_campaign_year between 2027 and 2100),
 invitation_day integer not null default 1 check (invitation_day between 1 and 14),
 reminder_day integer not null default 15 check (reminder_day between 2 and 27),
 due_day integer not null default 28 check (due_day between 15 and 28),
 subject_template text not null default 'Your {year} CMC Annual Systems Assessment is ready',
 email_intro text not null default 'Each year, we take time to reflect on the health of our church multiplication systems. Please complete your annual assessment in CMC Pathway.',
 updated_at timestamptz not null default now(),
 updated_by uuid,
 constraint annual_assessment_calendar_order check (invitation_day < reminder_day and reminder_day <= due_day)
);
create table if not exists public.cmc_annual_assessment_assignments (
 id uuid primary key default gen_random_uuid(),
 reporting_year integer not null check (reporting_year between 2022 and 2100),
 director_id uuid not null references public.candidate_profiles(id) on delete cascade,
 region text not null check (region in ('Central','East','Mountain Plains','Pacific','Southeast')),
 due_date date not null,
 assigned_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique (director_id,reporting_year)
);
create index if not exists annual_assessment_assignments_by_year
 on public.cmc_annual_assessment_assignments(reporting_year,region);
create table if not exists public.cmc_annual_assessment_emails (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.cmc_annual_assessment_assignments(id) on delete cascade,
 kind text not null check(kind in ('invitation','reminder')),
 recipient_email text not null,
 status text not null default 'sending' check(status in ('sending','sent','failed')),
 attempted_at timestamptz not null default now(),
 sent_at timestamptz,
 provider_id text,
 last_error text,
 unique(assignment_id,kind)
);
create index if not exists annual_assessment_emails_by_status
 on public.cmc_annual_assessment_emails(status,attempted_at);
insert into public.cmc_annual_assessment_settings
(id,enabled,first_campaign_year,invitation_day,reminder_day,due_day)
values ('national',true,2027,1,15,28)
on conflict (id) do nothing;
alter table public.cmc_annual_assessment_settings enable row level security;
alter table public.cmc_annual_assessment_assignments enable row level security;
alter table public.cmc_annual_assessment_emails enable row level security;
revoke all on public.cmc_annual_assessment_settings from anon,authenticated;
revoke all on public.cmc_annual_assessment_assignments from anon,authenticated;
revoke all on public.cmc_annual_assessment_emails from anon,authenticated;
grant select,insert,update,delete on public.cmc_annual_assessment_settings to service_role;
grant select,insert,update,delete on public.cmc_annual_assessment_assignments to service_role;
grant select,insert,update,delete on public.cmc_annual_assessment_emails to service_role;
