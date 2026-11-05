-- Google Calendar CMC Leadership: server-only cache of confirmed event occurrences.
-- Calendar remains authoritative; this cache only supports role-protected CMC Pathway views.
create table if not exists public.cmc_calendar_events_cache (
  calendar_id text not null,
  occurrence_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  description text not null default '',
  location text,
  event_url text,
  status text not null default 'confirmed' check (status in ('confirmed','tentative')),
  synced_at timestamptz not null default now(),
  primary key (calendar_id, occurrence_id),
  constraint cmc_calendar_event_duration check (ends_at > starts_at)
);
create index if not exists cmc_calendar_events_future
  on public.cmc_calendar_events_cache(calendar_id,starts_at);
alter table public.cmc_calendar_events_cache enable row level security;
revoke all on public.cmc_calendar_events_cache from anon,authenticated;
grant select,insert,update,delete on public.cmc_calendar_events_cache to service_role;
