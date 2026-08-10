-- Allows a CMC Pathway event to be intentionally shown on the public CMC website.
-- Run once in the Supabase SQL editor before deploying this feature.

alter table public.cmc_events
  add column if not exists public_listing boolean not null default false,
  add column if not exists public_url text not null default '';

create index if not exists cmc_events_public_listing_idx
  on public.cmc_events(public_listing, status, starts_at)
  where public_listing = true;
