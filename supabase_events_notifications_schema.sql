-- CMC Pathway events, invitations, attendance, and consolidated notifications.
-- Run once in the Supabase SQL editor before deploying the matching application code.

create table if not exists public.cmc_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text not null default '',
  address text not null default '',
  rsvp_deadline timestamptz,
  stage_key text not null default 'discern',
  region text,
  status text not null default 'draft',
  public_listing boolean not null default false,
  public_url text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmc_events_stage_key_check
    check (stage_key in ('discover', 'discern', 'develop', 'deploy')),
  constraint cmc_events_status_check
    check (status in ('draft', 'published', 'cancelled'))
);

create table if not exists public.cmc_event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.cmc_events(id) on delete cascade,
  user_id uuid not null,
  invited_by uuid not null,
  rsvp_status text not null default 'pending',
  attendance_status text not null default 'pending',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  notification_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(event_id, user_id),
  constraint cmc_event_invitations_rsvp_check
    check (rsvp_status in ('pending', 'going', 'declined')),
  constraint cmc_event_invitations_attendance_check
    check (attendance_status in ('pending', 'attended', 'did_not_attend', 'excused'))
);

create table if not exists public.cmc_notification_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_by uuid not null,
  subject text not null,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  status text not null default 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint cmc_notification_batches_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create index if not exists cmc_events_starts_at_idx
  on public.cmc_events(starts_at);
create index if not exists cmc_events_region_status_idx
  on public.cmc_events(region, status);
create index if not exists cmc_event_invitations_user_idx
  on public.cmc_event_invitations(user_id);
create index if not exists cmc_event_invitations_event_idx
  on public.cmc_event_invitations(event_id);
create index if not exists cmc_notification_batches_user_idx
  on public.cmc_notification_batches(user_id, created_at desc);

alter table public.cmc_events enable row level security;
alter table public.cmc_event_invitations enable row level security;
alter table public.cmc_notification_batches enable row level security;

-- These tables are read and written through authenticated Netlify Functions.
-- The service-role client used by those functions bypasses RLS.
