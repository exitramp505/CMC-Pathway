-- CMC Pathway account archiving.
-- Run once in the Supabase SQL editor before deploying the matching application code.

alter table public.candidate_profiles
  add column if not exists archived_at timestamptz;

create index if not exists candidate_profiles_archived_at_idx
  on public.candidate_profiles(archived_at);
